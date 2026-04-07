cd android
gradlew assemblerelease
cd app/build/outputs/apk/release
adb install app-release.apk
pause