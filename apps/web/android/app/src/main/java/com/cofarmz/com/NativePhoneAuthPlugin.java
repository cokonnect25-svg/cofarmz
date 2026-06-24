package com.cofarmz.com;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativePhoneAuth")
public class NativePhoneAuthPlugin extends Plugin {
    private String verificationId;

    @PluginMethod
    public void sendOtp(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            call.reject("phoneNumber is required");
            return;
        }

        AtomicBoolean resolved = new AtomicBoolean(false);

        getActivity().runOnUiThread(() -> {
            PhoneAuthProvider.OnVerificationStateChangedCallbacks callbacks =
                new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                    @Override
                    public void onVerificationCompleted(PhoneAuthCredential credential) {
                        if (resolved.compareAndSet(false, true)) {
                            signInAndResolve(call, credential, true);
                        }
                    }

                    @Override
                    public void onVerificationFailed(FirebaseException error) {
                        if (resolved.compareAndSet(false, true)) {
                            call.reject(error.getMessage(), error);
                        }
                    }

                    @Override
                    public void onCodeSent(String id, PhoneAuthProvider.ForceResendingToken token) {
                        verificationId = id;
                        if (resolved.compareAndSet(false, true)) {
                            JSObject result = new JSObject();
                            result.put("verificationId", id);
                            result.put("autoVerified", false);
                            call.resolve(result);
                        }
                    }
                };

            PhoneAuthOptions options = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
                .setPhoneNumber(phoneNumber)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(getActivity())
                .setCallbacks(callbacks)
                .build();

            PhoneAuthProvider.verifyPhoneNumber(options);
        });
    }

    @PluginMethod
    public void verifyOtp(PluginCall call) {
        String code = call.getString("code");
        String id = call.getString("verificationId", verificationId);

        if (id == null || id.isEmpty()) {
            call.reject("Send OTP first");
            return;
        }

        if (code == null || code.trim().length() < 6) {
            call.reject("Enter the OTP code");
            return;
        }

        PhoneAuthCredential credential = PhoneAuthProvider.getCredential(id, code.trim());
        signInAndResolve(call, credential, false);
    }

    private void signInAndResolve(PluginCall call, PhoneAuthCredential credential, boolean autoVerified) {
        FirebaseAuth.getInstance().signInWithCredential(credential)
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) {
                    Exception error = task.getException();
                    call.reject(error != null ? error.getMessage() : "Phone verification failed", error);
                    return;
                }

                FirebaseUser user = task.getResult().getUser();
                if (user == null) {
                    call.reject("Firebase user was not returned");
                    return;
                }

                user.getIdToken(true).addOnCompleteListener(tokenTask -> {
                    if (!tokenTask.isSuccessful() || tokenTask.getResult() == null) {
                        Exception error = tokenTask.getException();
                        call.reject(error != null ? error.getMessage() : "Could not read Firebase token", error);
                        return;
                    }

                    JSObject result = new JSObject();
                    result.put("idToken", tokenTask.getResult().getToken());
                    result.put("phoneNumber", user.getPhoneNumber());
                    result.put("autoVerified", autoVerified);
                    call.resolve(result);
                });
            });
    }
}
