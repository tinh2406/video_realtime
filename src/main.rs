use actix_files::{Files, NamedFile};
use actix_web::{get, web, App, HttpRequest, HttpResponse, HttpServer, Result};
use actix_ws::{CloseCode, CloseReason, Message};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

#[derive(Clone, Default)]
struct AppState {
    rooms: Arc<Mutex<HashMap<String, HashMap<String, Peer>>>>,
}

#[derive(Clone)]
struct Peer {
    sender: UnboundedSender<String>,
    name: String,
    mode: String,
}

#[get("/video/{filename:.*}")]
async fn video(req: HttpRequest, path: web::Path<String>) -> Result<impl actix_web::Responder> {
    let filename = path.into_inner();
    let video_path = PathBuf::from("videos").join(&filename);
    let file = NamedFile::open_async(video_path).await?;
    Ok(file.into_response(&req))
}

fn valid_room_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn send_room_event(state: &AppState, room: &str, except_peer: &str, event: Value) {
    if let Ok(mut rooms) = state.rooms.lock() {
        if let Some(peers) = rooms.get_mut(room) {
            peers.retain(|peer_id, peer| {
                peer_id == except_peer || peer.sender.send(event.to_string()).is_ok()
            });
            if peers.is_empty() {
                rooms.remove(room);
            }
        }
    }
}

fn remove_peer(state: &AppState, room: &str, peer_id: &str) {
    let should_remove_room = if let Ok(mut rooms) = state.rooms.lock() {
        if let Some(peers) = rooms.get_mut(room) {
            peers.remove(peer_id);
            peers.is_empty()
        } else {
            false
        }
    } else {
        false
    };

    if should_remove_room {
        if let Ok(mut rooms) = state.rooms.lock() {
            rooms.remove(room);
        }
    }
    send_room_event(state, room, peer_id, json!({ "type": "peer-left", "peerId": peer_id }));
}

fn handle_client_message(
    state: &AppState,
    outgoing: &UnboundedSender<String>,
    joined: &mut Option<(String, String)>,
    value: Value,
) {
    match value.get("type").and_then(Value::as_str) {
        Some("join") => {
            if joined.is_some() {
                return;
            }
            let Some(room) = value.get("room").and_then(Value::as_str) else {
                return;
            };
            let Some(peer_id) = value.get("peerId").and_then(Value::as_str) else {
                return;
            };
            if !valid_room_id(room) || peer_id.is_empty() || peer_id.len() > 64 {
                let _ = outgoing.send(json!({
                    "type": "error",
                    "message": "Invalid room or peer identifier."
                }).to_string());
                return;
            }

            let name = value
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Guest")
                .chars()
                .take(40)
                .collect::<String>();
            let mode = value
                .get("mode")
                .and_then(Value::as_str)
                .filter(|mode| ["call", "group", "live"].contains(mode))
                .unwrap_or("group")
                .to_string();

            if let Ok(mut rooms) = state.rooms.lock() {
                let peers = rooms.entry(room.to_string()).or_default();
                let existing = peers
                    .iter()
                    .map(|(id, peer)| {
                        json!({ "peerId": id, "name": peer.name, "mode": peer.mode })
                    })
                    .collect::<Vec<_>>();

                let _ = outgoing.send(json!({ "type": "peers", "peers": existing }).to_string());
                peers.insert(
                    peer_id.to_string(),
                    Peer {
                        sender: outgoing.clone(),
                        name: name.clone(),
                        mode,
                    },
                );
            }

            *joined = Some((room.to_string(), peer_id.to_string()));
            send_room_event(
                state,
                room,
                peer_id,
                json!({ "type": "peer-joined", "peerId": peer_id, "name": name }),
            );
        }
        Some("signal") => {
            let Some((room, own_peer_id)) = joined.as_ref() else {
                return;
            };
            let Some(to) = value.get("to").and_then(Value::as_str) else {
                return;
            };
            let Some(payload) = value.get("payload") else {
                return;
            };
            let from = value
                .get("from")
                .and_then(Value::as_str)
                .filter(|from| *from == own_peer_id.as_str())
                .unwrap_or(own_peer_id);
            if let Ok(rooms) = state.rooms.lock() {
                if let Some(peer) = rooms.get(room).and_then(|peers| peers.get(to)) {
                    let sender_name = rooms
                        .get(room)
                        .and_then(|peers| peers.get(own_peer_id))
                        .map(|peer| peer.name.as_str())
                        .unwrap_or("Guest");
                    let _ = peer.sender.send(
                        json!({
                            "type": "signal",
                            "from": from,
                            "name": sender_name,
                            "payload": payload
                        })
                        .to_string(),
                    );
                }
            }
        }
        Some("leave") => {
            if let Some((room, peer_id)) = joined.take() {
                remove_peer(state, &room, &peer_id);
            }
        }
        _ => {}
    }
}

async fn websocket(
    request: HttpRequest,
    body: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let (response, mut session, mut stream) = actix_ws::handle(&request, body)?;
    let (outgoing, mut incoming) = unbounded_channel::<String>();
    let app_state = state.get_ref().clone();

    actix_web::rt::spawn(async move {
        let mut joined: Option<(String, String)> = None;
        loop {
            tokio::select! {
                incoming_message = stream.next() => {
                    match incoming_message {
                        Some(Ok(Message::Text(text))) => {
                            if text.len() > 65_536 {
                                let _ = session.close(Some(CloseReason {
                                    code: CloseCode::Size,
                                    description: Some("Message too large".into()),
                                })).await;
                                break;
                            }
                            if let Ok(value) = serde_json::from_str::<Value>(&text) {
                                handle_client_message(&app_state, &outgoing, &mut joined, value);
                            }
                        }
                        Some(Ok(Message::Ping(bytes))) => {
                            if session.pong(&bytes).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(Message::Close(reason))) => {
                            let _ = session.close(reason).await;
                            break;
                        }
                        Some(Ok(_)) => {}
                        Some(Err(_)) | None => break,
                    }
                }
                outgoing_message = incoming.recv() => {
                    match outgoing_message {
                        Some(message) => {
                            if session.text(message).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
        if let Some((room, peer_id)) = joined {
            remove_peer(&app_state, &room, &peer_id);
        }
    });

    Ok(response)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    std::fs::create_dir_all("videos")?;
    let state = web::Data::new(AppState::default());
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .service(video)
            .route("/ws", web::get().to(websocket))
            .service(Files::new("/", "./dist").index_file("index.html"))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
