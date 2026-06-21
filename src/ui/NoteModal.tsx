import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  onSubmit: (note: string | null) => void;
  onCancel: () => void;
};

export function NoteModal({ visible, title, placeholder, onSubmit, onCancel }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  function handleSubmit() {
    const trimmed = text.trim();
    onSubmit(trimmed.length > 0 ? trimmed : null);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder ?? 'Notiz (optional)'}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            autoFocus
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.submitButton]} onPress={handleSubmit}>
              <Text style={styles.submitText}>Speichern</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#111',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#eee',
  },
  cancelText: {
    color: '#333',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#1f6feb',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
