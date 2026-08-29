import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "@/app/estilos";
import { Icon } from "@/components/icon";
import { useMedicines } from "@/context/medicines-provider";
import { responderPregunta } from "@/services/chat-responder";

type ChatMessage = {
  id: number;
  author: "user" | "bot";
  text: string;
};

export default function ChatScreen() {
  const { medicinas } = useMedicines();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      author: "bot",
      text: "Hola, soy tu asistente de medicinas. Puedes preguntarme: ¿qué le estoy dando?, ¿a qué hora? o ¿cuántas pastillas quedan?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  const enviarMensaje = () => {
    const texto = chatInput.trim();
    if (!texto) return;

    const respuesta = responderPregunta(texto, medicinas);

    setChatMessages((prev) => [
      ...prev,
      { id: Date.now(), author: "user", text: texto },
      { id: Date.now() + 1, author: "bot", text: respuesta },
    ]);
    setChatInput("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="chatbubble-ellipses-outline" size={26} color="#fff" />
          <Text style={styles.headerTitle}>Asistente de medicinas</Text>
        </View>
        <Text style={styles.headerSubtitle}>Pregunta qué se está dando o a qué hora.</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.view}>
          <View style={styles.chatCard}>
            <ScrollView style={styles.chatMessages}>
              {chatMessages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.chatBubble,
                    message.author === "user" ? styles.chatBubbleUser : styles.chatBubbleBot,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatBubbleText,
                      message.author === "user" && styles.chatBubbleTextUser,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ej. ¿Qué le estoy dando?"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                accessibilityLabel="Escribe tu pregunta"
              />
              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={enviarMensaje}
                accessibilityRole="button"
                accessibilityLabel="Enviar pregunta"
              >
                <Icon name="send-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
