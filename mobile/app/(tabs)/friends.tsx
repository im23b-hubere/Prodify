import { StyleSheet, Text, View } from "react-native";

export default function FriendsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Friends</Text>
      <Text style={styles.body}>Freundschaften und Aktivitäts-Feed folgen im nächsten Schritt über die Friendship-API.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fafafa",
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    color: "#a3a3a3",
    lineHeight: 22,
  },
});
