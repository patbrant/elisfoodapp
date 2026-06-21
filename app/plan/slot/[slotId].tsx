import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SlotEditorScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Slot Editor</Text>
      <Text style={styles.id}>id: {slotId}</Text>
      <Text style={styles.hint}>Placeholder — kommt in Slice 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  id: { fontFamily: 'Courier', marginBottom: 8 },
  hint: { color: '#666' },
});
