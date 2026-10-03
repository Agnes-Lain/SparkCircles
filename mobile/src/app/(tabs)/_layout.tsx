import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabBar } from '../../components/TabBar';
import { TABS, type TabDefinition } from '../../navigation/tabs';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation, insets }) => (
        <TabBar
          tabs={TABS}
          activeRoute={state.routes[state.index]?.name as TabDefinition['route']}
          bottomInset={insets.bottom}
          onTabPress={(route) => {
            const target = state.routes.find((r) => r.name === route);
            if (!target) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: target.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) navigation.navigate(route);
          }}
        />
      )}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.route} name={tab.route} options={{ title: t(tab.labelKey) }} />
      ))}
    </Tabs>
  );
}
