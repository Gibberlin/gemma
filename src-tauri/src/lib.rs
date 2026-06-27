// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_document_file(name: String, data: Vec<u8>) -> Result<String, String> {
    // Resolve home directory
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .map_err(|_| "Could not resolve home directory".to_string())?;
        
    let mut path = home;
    path.push("SenkuDocuments");
    
    // Create folder if it doesn't exist
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create folder: {}", e))?;
    }
    
    path.push(name);
    
    // Write bytes to file
    std::fs::write(&path, data)
        .map_err(|e| format!("Failed to write file: {}", e))?;
        
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_document_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, save_document_file, open_document_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
