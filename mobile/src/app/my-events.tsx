import { Redirect } from 'expo-router';

/** App link `my-events` (event emails): Sorties, "Mes sorties". */
export default function MyEventsLink() {
  return <Redirect href={{ pathname: '/', params: { tab: 'mine' } }} />;
}
