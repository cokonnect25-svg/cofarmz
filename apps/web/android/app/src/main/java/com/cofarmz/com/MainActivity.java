package com.cofarmz.com;

import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (!isConnected()) {
            showOfflinePage();
        }
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
            + "body { background:#1a2e1a; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; padding:24px; }"
            + ".logo { position:absolute; top:24px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; }"
            + ".logo-box { width:28px; height:28px; background:#4ade80; border-radius:8px; display:flex; align-items:center; justify-content:center; }"
            + ".logo-text { color:#4ade80; font-weight:700; font-size:14px; }"
            + ".badge { background:#ef4444; color:#fff; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:4px 12px; border-radius:999px; margin-bottom:16px; }"
            + "h1 { color:#fff; font-size:28px; font-weight:900; text-align:center; line-height:1.3; margin-bottom:12px; }"
            + "h1 span { color:#4ade80; }"
            + "p { color:#86a87a; font-size:13px; text-align:center; max-width:280px; line-height:1.6; margin-bottom:28px; }"
            + "button { background:#4ade80; color:#14532d; border:none; border-radius:16px; padding:16px 0; width:100%; max-width:280px; font-size:14px; font-weight:900; cursor:pointer; }"
            + "</style></head><body>"
            + "<div class='logo'>"
            + "<div class='logo-box'><svg width='16' height='16' viewBox='0 0 24 24' fill='none'>"
            + "<ellipse cx='12' cy='12' rx='10' ry='10' fill='#166534'/>"
            + "<path d='M7 10c1-3 4-4 5-8M12 2c0 4-3 6-5 9s0 6 5 7c5-1 7-4 5-7s-5-5-5-9z' stroke='#4ade80' stroke-width='1.5' fill='none' stroke-linecap='round'/>"
            + "</svg></div>"
            + "<span class='logo-text'>CoFarmz</span></div>"
            + "<div class='badge'>No Internet</div>"
            + "<h1>Fields don't wait.<br><span>Neither should you.</span></h1>"
            + "<p>CoFarmz connects farmers, buyers & equipment — but right now your signal is on a tea break.</p>"
            + "<button onclick='window.location.reload()'>Try Again</button>"
            + "</body></html>";

        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.loadData(html, "text/html", "UTF-8");
        setContentView(webView);
    }
}