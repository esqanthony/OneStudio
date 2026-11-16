import { NativeTabs } from 'expo-router/native-tabs';

import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.canvas}
      iconColor={{ default: colors.muted, selected: colors.ink }}
      labelStyle={{ default: { color: colors.muted }, selected: { color: colors.ink } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'film.stack', selected: 'film.stack.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
