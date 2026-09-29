package io.democracyonline.oscana;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends Activity {
    private static final String OFFICIAL = "https://oscana.nya.je";
    private static final String SERVERS = "servers";
    private static final String ACTIVE_SERVER = "active_server";
    private static final String WEB_STATE = "web_state";
    private WebView webView;
    private String activeServer;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String server = state == null ? null : state.getString(ACTIVE_SERVER);
        if (server != null && (server.equals(OFFICIAL) || savedServers().contains(server))) {
            openServer(server, state.getBundle(WEB_STATE));
        } else {
            showServers();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Reopening the launcher icon returns to the native server picker.
        showServers();
    }

    private Set<String> savedServers() {
        return new HashSet<>(getPreferences(MODE_PRIVATE).getStringSet(SERVERS, new HashSet<>()));
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void showServers() {
        closeWebView();
        ScrollView scroll = new ScrollView(this);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(dp(24), dp(28), dp(24), dp(24));
        scroll.addView(column);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.oscana_logo);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(88), dp(88));
        logoParams.gravity = Gravity.CENTER_HORIZONTAL;
        column.addView(logo, logoParams);

        TextView title = new TextView(this);
        title.setText(R.string.server_prompt);
        title.setTextSize(24);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(12), 0, dp(18));
        column.addView(title);

        ArrayList<String> servers = new ArrayList<>(savedServers());
        servers.remove(OFFICIAL);
        servers.sort(String::compareTo);
        servers.add(0, OFFICIAL);
        for (String server : servers) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            Button open = new Button(this);
            open.setText(server.equals(OFFICIAL) ? "Oscana · " + server : server);
            open.setAllCaps(false);
            open.setOnClickListener(view -> openServer(server));
            row.addView(open, new LinearLayout.LayoutParams(0, dp(60), 1));
            if (!server.equals(OFFICIAL)) {
                Button remove = new Button(this);
                remove.setText(R.string.server_remove);
                remove.setOnClickListener(view -> new AlertDialog.Builder(this)
                    .setMessage("Remove " + server + " from saved servers?")
                    .setNegativeButton(android.R.string.cancel, null)
                    .setPositiveButton(R.string.server_remove, (dialog, which) -> {
                        Set<String> updated = savedServers();
                        updated.remove(server);
                        getPreferences(MODE_PRIVATE).edit().putStringSet(SERVERS, updated).apply();
                        showServers();
                    }).show());
                row.addView(remove);
            }
            column.addView(row);
        }

        Button add = new Button(this);
        add.setText(R.string.server_add);
        add.setOnClickListener(view -> promptServer());
        column.addView(add);

        TextView hint = new TextView(this);
        hint.setText(R.string.server_switch_hint);
        hint.setPadding(0, dp(16), 0, 0);
        column.addView(hint);
        setContentView(scroll);
    }

    private void promptServer() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint(R.string.server_hint);
        LinearLayout container = new LinearLayout(this);
        container.setPadding(dp(20), 0, dp(20), 0);
        container.addView(input, new LinearLayout.LayoutParams(-1, -2));

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(R.string.server_add)
            .setView(container)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.server_open, null)
            .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            .setOnClickListener(view -> {
                String server = normalizedOrigin(input.getText().toString());
                if (server == null) {
                    input.setError(getString(R.string.server_invalid));
                    return;
                }
                Set<String> updated = savedServers();
                updated.add(server);
                getPreferences(MODE_PRIVATE).edit().putStringSet(SERVERS, updated).apply();
                dialog.dismiss();
                showServers();
                openServer(server);
            }));
        dialog.show();
    }

    private static String normalizedOrigin(String input) {
        try {
            URI uri = new URI(input.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                || uri.getRawFragment() != null || uri.getPort() > 65535
                || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()
                    && !"/".equals(uri.getRawPath()))) {
                return null;
            }
            return new URI("https", null, uri.getHost().toLowerCase(java.util.Locale.ROOT),
                uri.getPort() == 443 ? -1 : uri.getPort(), null, null, null).toString();
        } catch (URISyntaxException | IllegalArgumentException e) {
            return null;
        }
    }

    private void openServer(String server) {
        openServer(server, null);
    }

    private void openServer(String server, Bundle savedWebState) {
        closeWebView();
        activeServer = server;

        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.WHITE);
        // Target SDK 35 draws edge-to-edge. Keep game controls clear of system bars.
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(0, insets.getSystemWindowInsetTop(), 0,
                insets.getSystemWindowInsetBottom());
            return insets;
        });
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.getSettings().setSafeBrowsingEnabled(true);
        }
        ProgressBar loading = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        frame.addView(loading, progressParams);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                loading.setVisibility(progress == 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && server.equals(originOf(url))) return false;
                // Do not silently show a different server or an untrusted origin in the app.
                if ("https".equals(url.getScheme()) || "http".equals(url.getScheme())
                    || "mailto".equals(url.getScheme()) || "tel".equals(url.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame() || view != webView) return;
                loading.setVisibility(View.GONE);
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage(R.string.server_unavailable)
                    .setPositiveButton(R.string.server_retry, (dialog, which) -> view.reload())
                    .setNegativeButton(R.string.server_picker, (dialog, which) -> showServers())
                    .show();
            }
        });
        setContentView(frame);
        if (savedWebState == null || webView.restoreState(savedWebState) == null) {
            webView.loadUrl(server + "/");
        }
    }

    private static String originOf(Uri uri) {
        String host = uri.getHost();
        if (host == null) return null;
        String authority = host.contains(":") && !host.startsWith("[") ? "[" + host + "]" : host;
        return "https://" + authority.toLowerCase(java.util.Locale.ROOT)
            + (uri.getPort() == -1 || uri.getPort() == 443 ? "" : ":" + uri.getPort());
    }

    private void closeWebView() {
        if (webView == null) return;
        WebView previous = webView;
        webView = null;
        activeServer = null;
        previous.stopLoading();
        previous.setWebChromeClient(null);
        previous.setWebViewClient(new WebViewClient());
        ViewParent parent = previous.getParent();
        if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(previous);
        previous.destroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else if (webView != null) {
            showServers();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (webView != null) {
            state.putString(ACTIVE_SERVER, activeServer);
            Bundle webState = new Bundle();
            webView.saveState(webState);
            state.putBundle(WEB_STATE, webState);
        }
    }

    @Override
    protected void onDestroy() {
        closeWebView();
        super.onDestroy();
    }
}
