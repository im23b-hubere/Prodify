import { StyleSheet, Text, View } from "react-native";

export default function StatsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.body}>Hier kommen später Übersichten zu Sessions, Streaks und Trends hin.</Text>
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
