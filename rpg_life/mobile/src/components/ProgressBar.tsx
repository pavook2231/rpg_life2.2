import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { XPBar } from "../ui/XPBar";

type Props = {
  value: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({ value, color, style }: Props) {
  return <XPBar current={value} total={100} color={color} compact style={style} />;
}
