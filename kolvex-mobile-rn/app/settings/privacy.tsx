import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Trash2, Shield } from 'lucide-react-native';
import { Card, Button, Input } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { updatePassword } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword(newPassword);
      Alert.alert('Success', 'Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your data will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact Support', 'Please contact support@kolvex.app to delete your account.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Privacy & Security" showBack />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Change Password */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          CHANGE PASSWORD
        </Text>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={20} color={primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Update Password
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirm Password</Text>
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
            />
          </View>

          <Button
            variant="primary"
            size="md"
            fullWidth
            onPress={handleChangePassword}
            disabled={!newPassword || !confirmPassword || changingPassword}
          >
            {changingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </Card>

        {/* Security Info */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          SECURITY
        </Text>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={20} color={Colors.success} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Account Security
            </Text>
          </View>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Your account is secured with Supabase authentication. Sessions are automatically refreshed and encrypted.
          </Text>
        </Card>

        {/* Danger Zone */}
        <Text style={[styles.sectionTitle, { color: Colors.error }]}>
          DANGER ZONE
        </Text>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Trash2 size={20} color={Colors.error} />
            <Text style={[styles.cardTitle, { color: Colors.error }]}>
              Delete Account
            </Text>
          </View>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>
          <Button
            variant="destructive"
            size="md"
            fullWidth
            onPress={handleDeleteAccount}
            style={{ marginTop: Spacing.md }}
          >
            Delete Account
          </Button>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    marginTop: Spacing.lg,
  },
  card: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
