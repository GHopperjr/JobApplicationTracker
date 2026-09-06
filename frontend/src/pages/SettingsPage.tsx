import { GoalSettings } from '../components/settings/GoalSettings';
import { ProfileSection } from '../components/settings/ProfileSection';
import { SavedLocationList } from '../components/settings/SavedLocationList';

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-6 pb-12">
      <SavedLocationList />
      <GoalSettings />
      <ProfileSection />
    </div>
  );
}
