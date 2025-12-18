// Authentication functions using backend API
import { createClient } from "./client";

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
  display_name?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
}

interface SessionData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
}

/**
 * Set session in Supabase client after successful auth
 */
async function setSupabaseSession(session: SessionData): Promise<void> {
  if (!session.access_token || !session.refresh_token) {
    return;
  }

  const supabase = createClient();
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name,
        display_name: data.display_name,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Registration failed",
        errorCode: result.error_code,
      };
    }

    // If session is returned, set it in Supabase client
    if (result.session) {
      await setSupabaseSession(result.session);
    }

    return {
      success: true,
      data: {
        user: result.user,
        session: result.session,
        message: result.message,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred during sign up",
      errorCode: error.name,
    };
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(data: SignInData): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Login failed",
        errorCode: result.error_code,
      };
    }

    // Set session in Supabase client
    if (result.session) {
      await setSupabaseSession(result.session);
    }

    return {
      success: true,
      data: {
        user: result.user,
        session: result.session,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred during sign in",
      errorCode: error.name,
    };
  }
}

/**
 * Sign in with Google OAuth
 * @param redirectTo - Optional URL to redirect to after successful sign in
 */
export async function signInWithGoogle(redirectTo?: string): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/oauth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        redirectTo: redirectTo || "/dashboard",
      }),
    });

    const result = await response.json();

    if (!result.success || !result.url) {
      return {
        success: false,
        error: result.error || "Failed to initiate Google sign in",
      };
    }

    // Redirect to OAuth URL
    window.location.href = result.url;

    return {
      success: true,
      data: { url: result.url },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred during Google sign in",
      errorCode: error.name,
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    // Call backend API
    await fetch("/api/auth/signout", {
      method: "POST",
    });
  } catch (error) {
    // Ignore errors, continue with client-side sign out
    console.error("Sign out API error:", error);
  }

  // Also sign out from Supabase client
  const supabase = createClient();
  await supabase.auth.signOut();

  // Redirect to home page
  window.location.href = "/";
}

/**
 * Send password reset email
 */
export async function resetPassword(data: {
  email: string;
}): Promise<AuthResponse> {
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to send reset email",
        errorCode: result.error_code,
      };
    }

    return {
      success: true,
      data: { message: result.message },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred during password reset",
      errorCode: error.name,
    };
  }
}

/**
 * Update password (must be called from reset password page)
 * Uses Supabase client directly since the token is in URL hash
 */
export async function updatePassword(data: {
  password: string;
}): Promise<AuthResponse> {
  try {
    const supabase = createClient();
    
    // Supabase automatically handles the token from URL hash
    const { data: result, error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update password",
        errorCode: error.name,
      };
    }

    // Sign out after password update to force re-login
    await supabase.auth.signOut();

    return {
      success: true,
      data: { message: "Password updated successfully", user: result.user },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An error occurred during password update",
      errorCode: error.name,
    };
  }
}

/**
 * Get user-friendly error message from auth error
 */
export function getErrorMessage(error: any): string {
  if (!error) return "An unknown error occurred";

  // Handle common auth errors
  const message = error.message || error.error || error.toString();

  if (message.includes("Invalid login credentials") || message.includes("Invalid email or password")) {
    return "Invalid email or password";
  }
  if (message.includes("User already registered") || message.includes("already exists")) {
    return "An account with this email already exists";
  }
  if (message.includes("Email not confirmed") || message.includes("verify your email")) {
    return "Please verify your email address";
  }
  if (message.includes("Password should be") || message.includes("at least 6")) {
    return "Password must be at least 6 characters";
  }
  if (message.includes("Invalid email")) {
    return "Please enter a valid email address";
  }
  if (message.includes("network")) {
    return "Network error. Please check your connection";
  }
  if (message.includes("rate limit") || message.includes("Too many")) {
    return "Too many attempts. Please try again later";
  }

  // Return the original message if no match
  return message;
}
