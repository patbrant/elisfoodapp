import { StyleSheet, Text, View } from 'react-native';

export default function PlanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plan</Text>
      <Text style={styles.hint}>Placeholder — kommt in Slice 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  hint: { color: '#666' },
});
