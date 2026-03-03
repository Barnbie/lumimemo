import { View, Text, StyleSheet } from 'react-native';

export type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
};

export default function NoteCard({ note }: { note: Note }) {
  return (
    <View style={[styles.card, { backgroundColor: note.color }]}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.content} numberOfLines={4}>
        {note.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    opacity: 0.8,
  },
});
