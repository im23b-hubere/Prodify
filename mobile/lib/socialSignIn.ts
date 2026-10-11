import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export type SocialProvider = "apple" | "google";

export type AppleCredential = {
  identityToken: string;
  authorizationCode: string | null;
  givenName: string | null;
};

/** "cancelled" means the user dismissed the native sheet; that is not an error. */
export type SocialCredentialResult<T> = { status: "success"; credential: T } | { status: "cancelled" };

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

let googleModule: GoogleSignInModule | null | undefined;

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function requestAppleCredential(): Promise<SocialCredentialResult<AppleCredential>> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("Apple did not return an identity token.");
    return {
      status: "success",
      credential: {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        givenName: credential.fullName?.givenName ?? null,
      },
    };
  } catch (caught) {
    if (errorCode(caught) === "ERR_REQUEST_CANCELED") return { status: "cancelled" };
    throw caught;
  }
}

export function isGoogleSignInAvailable(): boolean {
  if (Platform.OS === "web") return false;
  const clientIds = googleClientIds();
  if (!clientIds.webClientId) return false;
  if (Platform.OS === "ios" && !clientIds.iosClientId) return false;
  return loadGoogleModule() !== null;
}

/** Returns a Google ID token whose audience is the web client id the backend verifies. */
export async function requestGoogleIdToken(): Promise<SocialCredentialResult<string>> {
  const google = loadGoogleModule();
  if (!google) throw new Error("Google sign-in is not available in this build.");
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = google;
  GoogleSignin.configure({ ...googleClientIds(), scopes: ["email", "profile"] });

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: "cancelled" };
    if (!response.data.idToken) throw new Error("Google did not return an ID token.");
    return { status: "success", credential: response.data.idToken };
  } catch (caught) {
    if (isErrorWithCode(caught) && caught.code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: "cancelled" };
    }
    throw caught;
  } finally {
    // Prodify keeps its own session; dropping Google's lets the next sign-in pick another account.
    void GoogleSignin.signOut().catch(() => undefined);
  }
}

function googleClientIds(): { webClientId: string; iosClientId: string } {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return {
    webClientId: stringOrEmpty(extra?.googleWebClientId),
    iosClientId: stringOrEmpty(extra?.googleIosClientId),
  };
}

function loadGoogleModule(): GoogleSignInModule | null {
  if (googleModule !== undefined) return googleModule;
  // Expo Go ships without the native Google Sign-In module; requiring it there throws.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    googleModule = null;
    return googleModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule = require("@react-native-google-signin/google-signin") as GoogleSignInModule;
  } catch {
    googleModule = null;
  }
  return googleModule;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorCode(caught: unknown): string | null {
  if (typeof caught !== "object" || caught === null || !("code" in caught)) return null;
  const { code } = caught as { code: unknown };
  return typeof code === "string" ? code : null;
}
