import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send, Bot, User, Sparkles, RefreshCw, List } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Avatar } from '@/components/ui';
import { Header } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { useChatSession, useConversations } from '@/hooks/useChat';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import type { ChatMessage } from '@/lib/types';

const SUGGESTED_PROMPTS = [
  "What's the sentiment on NVDA?",
  "Analyze Tesla's recent performance",
  "Top trending stocks today",
  "Compare AMD vs INTC",
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { stock } = useLocalSearchParams<{ stock?: string }>();
  const { colors, primary, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const {
    conversationId,
    messages,
    sending,
    error: chatError,
    createConversation,
    sendMessage: sendChatMessage,
    resetChat,
  } = useChatSession();

  const { data: conversationsData, refresh: refreshConversations } = useConversations();

  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Auto-create conversation with stock context if provided
  useEffect(() => {
    if (stock && !conversationId) {
      const initConversation = async () => {
        const conv = await createConversation(`Analysis: ${stock}`);
        if (conv) {
          await sendChatMessage(`Analyze the stock ${stock} - what's the current sentiment, recent news, and KOL opinions?`);
        }
      };
      initConversation();
    }
  }, [stock]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Create conversation if none exists
    if (!conversationId) {
      const conv = await createConversation();
      if (!conv) {
        Alert.alert('Error', 'Failed to create conversation. Please try again.');
        return;
      }
    }

    setInputText('');
    await sendChatMessage(text.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [conversationId, createConversation, sendChatMessage, sending]);

  const handleSuggestedPrompt = (prompt: string) => {
    setInputText(prompt);
    handleSend(prompt);
  };

  const handleNewChat = useCallback(() => {
    resetChat();
    setShowHistory(false);
  }, [resetChat]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatarContainer, { backgroundColor: `${primary}20` }]}>
            <Bot size={20} color={primary} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isUser ? primary : colors.card,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isUser ? '#FFFFFF' : colors.foreground },
            ]}
          >
            {item.content}
          </Text>
        </View>
        {isUser && (
          <View style={[styles.avatarContainer, { backgroundColor: colors.muted }]}>
            <User size={20} color={colors.foreground} />
          </View>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!sending) return null;

    return (
      <View style={[styles.messageContainer, styles.assistantMessage]}>
        <View style={[styles.avatarContainer, { backgroundColor: `${primary}20` }]}>
          <Bot size={20} color={primary} />
        </View>
        <View style={[styles.messageBubble, { backgroundColor: colors.card }]}>
          <View style={styles.typingIndicator}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.typingDot, { backgroundColor: colors.mutedForeground }]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Conversation history view
  if (showHistory) {
    const conversations = conversationsData?.conversations || [];
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title="Chat History"
          rightAction={
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowHistory(false)}
            >
              <Text style={[styles.headerButtonText, { color: primary }]}>Done</Text>
            </TouchableOpacity>
          }
        />
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={async () => {
                // Load this conversation
                const { loadConversation } = require('@/hooks/useChat');
                // For now, just close history
                setShowHistory(false);
              }}
            >
              <Text style={[styles.historyTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title || 'Untitled Conversation'}
              </Text>
              <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                {item.message_count} messages
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyHistory}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No conversations yet
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="AI Assistant"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.muted }]}
              onPress={() => {
                refreshConversations();
                setShowHistory(true);
              }}
            >
              <List size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.muted }]}
              onPress={handleNewChat}
            >
              <RefreshCw size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        }
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={renderTypingIndicator}
          ListEmptyComponent={
            <View style={styles.welcomeContainer}>
              <View style={[styles.welcomeIcon, { backgroundColor: `${primary}15` }]}>
                <Bot size={40} color={primary} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                AI Investment Assistant
              </Text>
              <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
                Ask me about stocks, market trends, KOL analysis, and more.
              </Text>
            </View>
          }
        />

        {/* Suggested Prompts */}
        {messages.length === 0 && (
          <View style={styles.suggestedContainer}>
            <View style={styles.suggestedHeader}>
              <Sparkles size={16} color={primary} />
              <Text style={[styles.suggestedTitle, { color: colors.foreground }]}>
                Try asking
              </Text>
            </View>
            <View style={styles.suggestedList}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={[styles.suggestedChip, { backgroundColor: isDark ? colors.muted : '#F3F4F6', borderColor: colors.border }]}
                  onPress={() => handleSuggestedPrompt(prompt)}
                >
                  <Text style={[styles.suggestedText, { color: colors.foreground }]}>
                    {prompt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Error Banner */}
        {chatError && (
          <View style={[styles.errorBanner, { backgroundColor: `${Colors.error}15` }]}>
            <Text style={[styles.errorText, { color: Colors.error }]}>{chatError}</Text>
          </View>
        )}

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom || Spacing.md,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? Colors.dark.inputBackground : Colors.light.inputBackground, borderColor: isDark ? Colors.dark.inputBorder : Colors.light.inputBorder }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Ask about stocks, trends, KOLs..."
              placeholderTextColor={colors.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: inputText.trim() ? primary : colors.muted,
                },
              ]}
              onPress={() => handleSend(inputText)}
              disabled={!inputText.trim() || sending}
            >
              <Send size={18} color={inputText.trim() ? '#FFFFFF' : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  keyboardAvoid: {
    flex: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  messagesList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.sm,
  },
  messageText: {
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: Spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  suggestedContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  suggestedTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  suggestedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestedChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  suggestedText: {
    fontSize: FontSize.sm,
  },
  errorBanner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  // History
  historyList: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  historyItem: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  historyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  historyMeta: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyText: {
    fontSize: FontSize.base,
  },
});
