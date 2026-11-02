/**
 * Static checks for Capacitor release readiness.
 * These checks do not require Android Studio or Xcode and never inspect secrets.
 */
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "capacitor.config.ts",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/build.gradle",
  "ios/App/App/Info.plist",
  "src/lib/inAppPurchases.ts",
  "docs/IN_APP_PURCHASES.md",
];

let passed = 0;
let failed = 0;

async function checkFile(path: string): Promise<void> {
  try {
    await access(path);
    passed += 1;
    console.log(`  ok   ${path}`);
  } catch {
    failed += 1;
    console.log(`  FAIL ${path} is missing`);
  }
}

async function checkText(path: string, needle: string, label: string): Promise<void> {
  try {
    const text = await readFile(path, "utf8");
    if (text.includes(needle)) {
      passed += 1;
      console.log(`  ok   ${label}`);
    } else {
      failed += 1;
      console.log(`  FAIL ${label}`);
    }
  } catch {
    failed += 1;
    console.log(`  FAIL ${label} (file unavailable)`);
  }
}

console.log("\\nraritone native release check\\n");
for (const path of requiredFiles) await checkFile(path);
await checkText("capacitor.config.ts", "com.raritone.app", "Android/iOS share the Raritone application id");
await checkText("android/app/src/main/AndroidManifest.xml", "android.permission.CAMERA", "Android camera permission is declared");
await checkText("ios/App/App/Info.plist", "NSCameraUsageDescription", "iOS camera usage description is declared");
await checkText("src/lib/inAppPurchases.ts", "submitVerifiedReceipt", "client receipt submission seam exists");
await checkText("server/routes/billing.ts", "assertStoreProduct", "server validates store product ids");

console.log(`\\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("native release configuration looks consistent");
