/// Command to extract the embedded icon from a Windows executable or file.
///
/// Uses the Windows Shell API (`SHGetFileInfo`) to retrieve the icon associated
/// with any path, then renders it to a 32×32 bitmap and returns a base64-encoded
/// PNG data URL. Works for `.exe` files (uses their embedded icon) and any other
/// file type (uses the Windows shell icon for that file extension).
///
/// Returns `None` if the path does not exist or icon extraction fails — the
/// frontend falls back to the folder icon in that case.
use base64::Engine;

/// Extracts the shell icon for the given path and returns a PNG data URL.
///
/// # Arguments
/// * `path` - Absolute path to the file (typically a `.exe`)
///
/// # Returns
/// `Some("data:image/png;base64,...")` on success, `None` on any failure.
///
/// # Errors
/// Returns an error string if a fatal OS-level failure occurs.
#[tauri::command]
pub fn get_file_icon(path: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        extract_icon_windows(&path).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(None)
    }
}

#[cfg(target_os = "windows")]
fn extract_icon_windows(path: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, RGBQUAD,
    };
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_SMALLICON};
    use windows::Win32::UI::WindowsAndMessaging::{
        DestroyIcon, DrawIconEx, DI_FLAGS,
    };
    use windows::core::PCWSTR;

    // Encode path as wide string
    let wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut shfi = SHFILEINFOW::default();
    let flags = SHGFI_ICON | SHGFI_SMALLICON;

    let ret = unsafe {
        SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        )
    };

    if ret == 0 || shfi.hIcon.is_invalid() {
        return Ok(None);
    }

    let hicon = shfi.hIcon;
    // SHGFI_SMALLICON returns a 16×16 icon — match that exactly.
    let size = 16i32;

    // Create a memory DC and bitmap to render the icon into
    let result = unsafe {
        let hdc_screen = windows::Win32::Graphics::Gdi::GetDC(None);
        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        let hbm = CreateCompatibleBitmap(hdc_screen, size, size);
        let hbm_old = SelectObject(hdc_mem, hbm.into());

        // Fill with white background first
        let white_brush = windows::Win32::Graphics::Gdi::CreateSolidBrush(
            windows::Win32::Foundation::COLORREF(0x00FFFFFF),
        );
        let rect = windows::Win32::Foundation::RECT {
            left: 0, top: 0, right: size, bottom: size,
        };
        windows::Win32::Graphics::Gdi::FillRect(hdc_mem, &rect, white_brush);
        let _ = DeleteObject(white_brush.into());

        // Draw icon into the memory bitmap
        let _ = DrawIconEx(hdc_mem, 0, 0, hicon, size, size, 0, None, DI_FLAGS(0x0003));

        // Extract pixels via GetDIBits
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: size,
                biHeight: -size, // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let pixel_count = (size * size) as usize;
        let mut pixels: Vec<u8> = vec![0u8; pixel_count * 4];
        GetDIBits(
            hdc_mem,
            hbm,
            0,
            size as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // GetDIBits returns BGRA; convert to RGBA
        for chunk in pixels.chunks_mut(4) {
            chunk.swap(0, 2); // B↔R
            // Make white pixels transparent
            if chunk[0] == 255 && chunk[1] == 255 && chunk[2] == 255 {
                chunk[3] = 0;
            } else {
                chunk[3] = 255;
            }
        }

        // Clean up GDI objects
        SelectObject(hdc_mem, hbm_old);
        let _ = DeleteObject(hbm.into());
        let _ = DeleteDC(hdc_mem);
        windows::Win32::Graphics::Gdi::ReleaseDC(None, hdc_screen);
        let _ = DestroyIcon(hicon);

        pixels
    };

    // Encode as PNG using the `image` crate is not available; use a minimal PNG encoder
    let png_bytes = encode_rgba_to_png(&result, size as u32, size as u32);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(Some(format!("data:image/png;base64,{}", b64)))
}

/// Minimal PNG encoder for RGBA pixel data — avoids pulling in the `image` crate.
///
/// Encodes raw RGBA pixels as a valid PNG with IHDR, IDAT (filtered), and IEND chunks.
fn encode_rgba_to_png(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
    fn crc32(data: &[u8]) -> u32 {
        let mut crc = 0xFFFF_FFFFu32;
        for &byte in data {
            crc ^= byte as u32;
            for _ in 0..8 {
                if crc & 1 != 0 {
                    crc = (crc >> 1) ^ 0xEDB8_8320;
                } else {
                    crc >>= 1;
                }
            }
        }
        !crc
    }

    fn write_chunk(out: &mut Vec<u8>, tag: &[u8; 4], data: &[u8]) {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(tag);
        out.extend_from_slice(data);
        let mut crc_input = Vec::with_capacity(4 + data.len());
        crc_input.extend_from_slice(tag);
        crc_input.extend_from_slice(data);
        out.extend_from_slice(&crc32(&crc_input).to_be_bytes());
    }

    let mut out = Vec::new();
    // PNG signature
    out.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR
    let mut ihdr = Vec::new();
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.extend_from_slice(&[8, 6, 0, 0, 0]); // 8-bit RGBA, deflate, no filter, no interlace
    write_chunk(&mut out, b"IHDR", &ihdr);

    // Build raw scanlines with filter byte 0 (None) prepended to each row
    let stride = width as usize * 4;
    let mut raw = Vec::with_capacity((1 + stride) * height as usize);
    for row in 0..height as usize {
        raw.push(0u8); // filter type None
        raw.extend_from_slice(&rgba[row * stride..(row + 1) * stride]);
    }

    // Deflate compress using miniz_oxide (bundled with Tauri's flate2 chain)
    let compressed = miniz_oxide::deflate::compress_to_vec_zlib(&raw, 6);
    write_chunk(&mut out, b"IDAT", &compressed);
    write_chunk(&mut out, b"IEND", &[]);

    out
}
