package com.cofarmz.com;

import android.app.Activity;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    private AppUpdateManager appUpdateManager;
    private ActivityResultLauncher<IntentSenderRequest> appUpdateLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (!isConnected()) {
            super.onCreate(null);
            startActivity(new Intent(this, OfflineActivity.class));
            finish();
            return;
        }

        registerPlugin(NativePhoneAuthPlugin.class);
        super.onCreate(savedInstanceState);

        setupInAppUpdates();
        checkForImmediateUpdate();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumeImmediateUpdateIfNeeded();
    }

    private boolean isConnected() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void setupInAppUpdates() {
        appUpdateManager = AppUpdateManagerFactory.create(this);
        appUpdateLauncher = registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> {
                    if (result.getResultCode() != Activity.RESULT_OK) {
                        Log.d(TAG, "In-app update flow ended with result: " + result.getResultCode());
                    }
                }
        );
    }

    private void checkForImmediateUpdate() {
        if (appUpdateManager == null) return;

        appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(appUpdateInfo -> {
                    if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                            && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                        startImmediateUpdate(appUpdateInfo);
                    }
                })
                .addOnFailureListener(error -> Log.d(TAG, "Unable to check app update", error));
    }

    private void resumeImmediateUpdateIfNeeded() {
        if (appUpdateManager == null) return;

        appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(appUpdateInfo -> {
                    if (appUpdateInfo.updateAvailability()
                            == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                        startImmediateUpdate(appUpdateInfo);
                    }
                })
                .addOnFailureListener(error -> Log.d(TAG, "Unable to resume app update", error));
    }

    private void startImmediateUpdate(AppUpdateInfo appUpdateInfo) {
        if (appUpdateLauncher == null) return;

        try {
            appUpdateManager.startUpdateFlowForResult(
                    appUpdateInfo,
                    appUpdateLauncher,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
            );
        } catch (Exception error) {
            Log.d(TAG, "Unable to start app update", error);
        }
    }
}
