package com.cofarmz.com;

import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (!isConnected()) {
            // Show native offline screen BEFORE Capacitor boots
            super.onCreate(null);
            setContentView(R.layout.activity_offline);

            Button retryBtn = findViewById(R.id.retryButton);
            retryBtn.setOnClickListener(v -> {
                if (isConnected()) {
                    // Restart activity fully so Capacitor boots normally
                    Intent intent = getIntent();
                    finish();
                    startActivity(intent);
                } else {
                    Toast.makeText(this, "Still offline. Please check your connection.", Toast.LENGTH_SHORT).show();
                }
            });
            return;
        }

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