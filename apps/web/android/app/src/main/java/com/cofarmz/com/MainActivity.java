package com.cofarmz.com;

import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (!isConnected()) {
            // Launch offline screen BEFORE super.onCreate — Capacitor never boots
            super.onCreate(null);
            startActivity(new Intent(this, OfflineActivity.class));
            finish();
            return;
        }
        registerPlugin(NativePhoneAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }

    private boolean isConnected() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
}
