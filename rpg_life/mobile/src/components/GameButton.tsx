import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { Button } from "../ui/Button";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GameButton({ label, onPress, variant = "primary", disabled = false, style }: Props) {
  return <Button label={label} onPress={onPress} variant={variant} disabled={disabled} style={style} />;
}
