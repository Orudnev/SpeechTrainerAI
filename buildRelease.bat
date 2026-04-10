cd android
call gradlew assemblerelease
cd app/build/outputs/apk/release
dir
adb install app-release.apk
pause