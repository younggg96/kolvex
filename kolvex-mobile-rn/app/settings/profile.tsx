import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import { Avatar, Button, Input, Card } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, primary } = useTheme();
  const { user } = useAuth();
  const { data: profile, updateProfile, loading: profileLoading } = useUserProfile();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        username: username.trim(),
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    username !== (profile?.username || '') ||
    displayName !== (profile?.display_name || '') ||
    bio !== (profile?.bio || '');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Edit Profile" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar
                name={displayName || username || 'User'}
                source={profile?.avatar_url || undefined}
                size="2xl"
              />
              <TouchableOpacity
                style={[styles.cameraButton, { backgroundColor: primary }]}
                onPress={() => Alert.alert('Coming Soon', 'Avatar upload will be available soon.')}
              >
                <Camera size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <Card style={styles.formCard}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Username</Text>
              <Input
                value={username}
                onChangeText={setUsername}
                placeholder="Your username"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Display Name</Text>
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How others see you"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
              <Input
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                multiline
                numberOfLines={4}
                style={styles.bioInput}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
              <Input
                value={user?.email || ''}
                editable={false}
                placeholder="Email"
                style={{ opacity: 0.5 }}
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Email cannot be changed here
              </Text>
            </View>
          </Card>

          {/* Save Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.lg },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  formCard: {
    marginBottom: Spacing.xl,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});
