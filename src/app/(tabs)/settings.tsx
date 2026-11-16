import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-line py-3">
      <Text className="text-base text-muted">{label}</Text>
      <Text className="ml-4 flex-shrink text-right text-base text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [status, setStatus] = useState<string | null>(null);

  async function checkForUpdate() {
    if (!Updates.isEnabled) {
      setStatus('Updates are not enabled in this build.');
      return;
    }
    try {
      setStatus('Checking…');
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('You are on the latest version.');
        return;
      }
      setStatus('Downloading update…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      setStatus(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-32 gap-6">
        <Text className="text-4xl font-extrabold text-ink">Settings</Text>

        <View className="rounded-2xl bg-surface px-4">
          <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
          <Row label="Build" value={Constants.nativeBuildVersion ?? '—'} />
          <Row label="Update channel" value={Updates.channel ?? '—'} />
          <Row
            label="Running"
            value={Updates.isEmbeddedLaunch ? 'Built-in code' : `Update ${Updates.updateId?.slice(0, 8)}`}
          />
        </View>

        <View className="gap-3">
          <Button title="Check for update" variant="secondary" onPress={checkForUpdate} />
          {status ? <Text className="text-center text-sm text-muted">{status}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
