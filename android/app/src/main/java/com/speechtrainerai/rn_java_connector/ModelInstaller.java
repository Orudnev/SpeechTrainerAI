package com.speechtrainerai.rn_java_connector;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import java.io.*;

public class ModelInstaller {

    private static final String TAG = "ModelInstaller";

    /**
     * Copies a full folder from assets into internal storage.
     *
     * @param context Android context
     * @param assetFolderName folder in assets (e.g. "vosk-model-small-ru")
     * @return installed path in filesDir
     */
    public static String installModelIfNeeded(Context context, String assetFolderName)
            throws IOException {

        File targetDir = new File(context.getFilesDir(), assetFolderName);

        if (targetDir.exists() && targetDir.isDirectory()) {
            Log.i(TAG, "Model already installed: " + targetDir.getAbsolutePath());
            return targetDir.getAbsolutePath();
        }

        Log.i(TAG, "Installing model from assets: " + assetFolderName);
        copyAssetFolder(context.getAssets(), assetFolderName, targetDir.getAbsolutePath());

        Log.i(TAG, "Model installed at: " + targetDir.getAbsolutePath());
        return targetDir.getAbsolutePath();
    }

    private static void copyAssetFolder(AssetManager assets,
                                        String fromAssetPath,
                                        String toPath) throws IOException {

        String[] files = assets.list(fromAssetPath);
        if (files == null) return;

        File dir = new File(toPath);
        if (!dir.exists()) dir.mkdirs();

        for (String file : files) {
            String assetFilePath = fromAssetPath + "/" + file;
            String targetFilePath = toPath + "/" + file;

            String[] subFiles = assets.list(assetFilePath);

            if (subFiles != null && subFiles.length > 0) {
                // directory
                copyAssetFolder(assets, assetFilePath, targetFilePath);
            } else {
                // file
                copyAssetFile(assets, assetFilePath, targetFilePath);
            }
        }
    }

    private static void copyAssetFile(AssetManager assets,
                                      String assetFilePath,
                                      String targetFilePath) throws IOException {

        InputStream in = assets.open(assetFilePath);
        OutputStream out = new FileOutputStream(targetFilePath);

        byte[] buffer = new byte[4096];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }

        in.close();
        out.flush();
        out.close();
    }
}
