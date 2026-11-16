import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';

export default function ProjectsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <View className="px-5 pt-4">
        <Text className="text-4xl font-extrabold text-ink">Projects</Text>
      </View>

      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-ink">
          <View className="h-10 w-10 rounded-full bg-record" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-ink">No projects yet</Text>
          <Text className="text-center text-base text-muted">
            Record your first video. The camera arrives in the next build.
          </Text>
        </View>
        <View className="w-full">
          <Button title="New project" disabled />
        </View>
      </View>
    </SafeAreaView>
  );
}
