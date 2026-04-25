package com.cofarmz.com;

import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        
        // ✅ Check BEFORE super.onCreate() so Capacitor WebView never starts when offline
        if (!isConnected()) {
            super.onCreate(null); // minimal init only
            showOfflinePage();
            return;
        }

        super.onCreate(savedInstanceState); // full Capacitor boot only when online
    }

    private boolean isConnected() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void showOfflinePage() {
        String html = "<!DOCTYPE html><html><head>"
            + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            + "<style>"
            + "* { margin:0; padding:0; box-sizing:border-box; }"
            + "body { background:#1a2e1a; min-height:100vh; display:flex; flex-direction:column;"
            + "align-items:center; justify-content:center; font-family:sans-serif; padding:24px; position:relative; overflow:hidden; }"
            + ".blob1 { position:absolute; top:-60px; right:-60px; width:180px; height:180px;"
            + "border-radius:50%; background:#2d5a1b; opacity:0.4; }"
            + ".blob2 { position:absolute; bottom:-40px; left:-40px; width:150px; height:150px;"
            + "border-radius:50%; background:#1e3d14; opacity:0.5; }"
            + ".logo { position:absolute; top:24px; left:50%; transform:translateX(-50%);"
            + "display:flex; align-items:center; gap:8px; white-space:nowrap; }"
            + ".logo-box { width:28px; height:28px; background:#4ade80; border-radius:8px;"
            + "display:flex; align-items:center; justify-content:center; }"
            + ".logo-text { color:#4ade80; font-weight:700; font-size:14px; }"
            + ".badge { background:#ef4444; color:#fff; font-size:11px; font-weight:700;"
            + "text-transform:uppercase; padding:4px 12px; border-radius:999px; margin-bottom:16px;"
            + "letter-spacing:0.1em; }"
            + "h1 { color:#fff; font-size:26px; font-weight:900; text-align:center;"
            + "line-height:1.3; margin-bottom:12px; }"
            + "h1 span { color:#4ade80; }"
            + "p { color:#86a87a; font-size:13px; text-align:center; max-width:280px;"
            + "line-height:1.6; margin-bottom:28px; }"
            + ".card { width:100%; max-width:280px; background:#0f2010; border:1px solid #1e4020;"
            + "border-radius:16px; padding:16px; margin-bottom:24px; }"
            + ".card-title { color:#4ade80; font-size:10px; font-weight:700; text-transform:uppercase;"
            + "letter-spacing:0.1em; margin-bottom:12px; }"
            + ".card-item { display:flex; align-items:center; gap:8px; margin-bottom:8px; }"
            + ".dot { width:6px; height:6px; border-radius:50%; background:#4ade80; flex-shrink:0; }"
            + ".card-item span { color:#86a87a; font-size:11px; }"
            + "button { background:#4ade80; color:#14532d; border:none; border-radius:16px;"
            + "padding:16px 0; width:100%; max-width:280px; font-size:14px; font-weight:900;"
            + "cursor:pointer; transition:opacity 0.2s; }"
            + "button:active { opacity:0.8; }"
            + ".quote { margin-top:16px; font-size:11px; font-style:italic; color:#3d5c38; text-align:center; }"
            + "</style></head><body>"
            + "<div class='blob1'></div>"
            + "<div class='blob2'></div>"
            + "<div class='logo'>"
            + "<div class='logo-box'>"
            + "<svg width='16' height='16' viewBox='0 0 24 24' fill='none'>"
            + "<ellipse cx='12' cy='12' rx='10' ry='10' fill='#166534'/>"
            + "<path d='M7 10c1-3 4-4 5-8M12 2c0 4-3 6-5 9s0 6 5 7c5-1 7-4 5-7s-5-5-5-9z'"
            + " stroke='#4ade80' stroke-width='1.5' fill='none' stroke-linecap='round'/>"
            + "</svg>"
            + "</div>"
            + "<span class='logo-text'>CoFarmz</span>"
            + "</div>"
            + "<div class='badge'>No Internet</div>"
            + "<h1>Fields don't wait.<br><span>Neither should you.</span></h1>"
            + "<p>CoFarmz connects farmers, buyers &amp; equipment — but right now your signal is on a tea break.</p>"
            + "<div class='card'>"
            + "<div class='card-title'>While you wait, remember:</div>"
            + "<div class='card-item'><div class='dot'></div><span>Rent or lend equipment nearby</span></div>"
            + "<div class='card-item'><div class='dot'></div><span>Buy &amp; sell crops directly</span></div>"
            + "<div class='card-item'><div class='dot'></div><span>Post your farm tales as reels</span></div>"
            + "<div class='card-item'><div class='dot'></div><span>Find farmers &amp; buyers around you</span></div>"
            + "</div>"
            + "<button id='retryBtn' onclick='retryConnection()'>Try Again</button>"
            + "<p class='quote'>\"Every seed needs patience — your connection will return.\"</p>"
            + "<script>"
            + "function retryConnection() {"
            + "  var btn = document.getElementById('retryBtn');"
            + "  btn.textContent = 'Checking...';"
            + "  btn.style.opacity = '0.7';"
            + "  fetch('https://cofarmz-backend-866114557322.asia-south1.run.app', {mode:'no-cors'})"
            + "  .then(function() { window.location.reload(); })"
            + "  .catch(function() {"
            + "    btn.textContent = 'Still offline...';"
            + "    setTimeout(function() {"
            + "      btn.textContent = 'Try Again';"
            + "      btn.style.opacity = '1';"
            + "    }, 2000);"
            + "  });"
            + "}"
            + "</script>"
            + "</body></html>";

        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.loadData(html, "text/html", "UTF-8");
        setContentView(webView);
    }
}