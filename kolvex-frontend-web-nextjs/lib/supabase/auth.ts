// Authentication functions using Supabase
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

/**
 * Sign up a new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  try {
    const supabase = createClient();

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.name || data.display_name,
          full_name: data.name || data.display_name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }

    return {
      success: true,
      data: authData,
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
    const supabase = createClient();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }

    return {
      success: true,
      data: authData,
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
 */
export async function signInWithGoogle(): Promise<AuthResponse> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }

    return {
      success: true,
      data,
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
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

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
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }

    return {
      success: true,
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
 */
export async function updatePassword(data: {
  password: string;
}): Promise<AuthResponse> {
  try {
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }

    return {
      success: true,
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
 * Get user-friendly error message from Supabase auth error
 */
export function getErrorMessage(error: any): string {
  if (!error) return "An unknown error occurred";

  // Handle common Supabase auth errors
  const message = error.message || error.toString();

  if (message.includes("Invalid login credentials")) {
    return "Invalid email or password";
  }
  if (message.includes("User already registered")) {
    return "An account with this email already exists";
  }
  if (message.includes("Email not confirmed")) {
    return "Please verify your email address";
  }
  if (message.includes("Password should be")) {
    return "Password must be at least 6 characters";
  }
  if (message.includes("Invalid email")) {
    return "Please enter a valid email address";
  }
  if (message.includes("network")) {
    return "Network error. Please check your connection";
  }

  // Return the original message if no match
  return message;
}
