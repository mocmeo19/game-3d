import type { CharacterState } from '../../types/character';
import { GameLoadingScreen } from '../../loading/GameLoadingScreen';
import { controlHelp } from '../core/input/controlLayouts';
import { ShooterScreen } from '../core/screen/ShooterScreen';
import { useShooterMatch, type CreateShooterEngine } from '../core/screen/useShooterMatch';
import type { CityEngine } from './CityEngine';
import type { CityMapKind } from './map/cityAssets';
import { CITY_CONTROLS } from './cityRules';
import { EMPTY_CITY_VIEW, type CityView } from './citySnapshot';
import { CharacterWheel } from './hud/CharacterWheel';
import { CityBannerView } from './hud/CityBannerView';
import { CityBigMap } from './hud/CityBigMap';
import { CityMinimap } from './hud/CityMinimap';
import { CityTopBar } from './hud/CityTopBar';
import { CityVitals } from './hud/CityVitals';
import { DialogueBox } from './hud/DialogueBox';
import { InteractionPrompt } from './hud/InteractionPrompt';
import { MissionObjective } from './hud/MissionObjective';
import { ShopPanel } from './hud/ShopPanel';
import { Speedometer } from './hud/Speedometer';

/** The map the open world is played on: the generated city, or the Dallas photo city when its baked files are in public/maps/city. */
const CITY_MAP: CityMapKind = 'generated';

/** The engine and the city map load together, all out of the startup bundle; the scenery streams in after. */
const loadCityEngine = async (): Promise<CreateShooterEngine<CityEngine, CityView>> => {
  const [{ CityEngine }, { loadCitySource }] = await Promise.all([import('./CityEngine'), import('./map/cityAssets')]);
  const source = await loadCitySource(CITY_MAP);
  return (host, state, onState, sensitivity) => new CityEngine(host, state, source, onState, sensitivity);
};

const CONTROLS = controlHelp(CITY_CONTROLS);

interface CityScreenProps {
  characterState: CharacterState;
  onExit: () => void;
}

/** The open world: the city around the shared shooter frame, with the city's own HUD, maps and menus. */
export function CityScreen({ characterState, onExit }: CityScreenProps) {
  const match = useShooterMatch(characterState, { loadEngine: loadCityEngine, initialView: EMPTY_CITY_VIEW, difficulty: 'normal' });
  const { engine, state, press } = match;
  const view = state.view;
  const closeMenu = () => engine.current?.closeMenu();

  return (
    <ShooterScreen
      match={match}
      loadingKind="city"
      controls={CONTROLS}
      onExit={onExit}
      earnedGold={null}
      top={<CityTopBar view={view} />}
      killFeed={null}
      radar={
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col items-center gap-1.5">
          <CityMinimap view={view} />
          {state.alive && <CityVitals health={state.health} armor={state.armor} />}
        </div>
      }
      vitals={view.vehicle && <Speedometer vehicle={view.vehicle} />}
      isMessageHidden={!!view.banner}
      isCrosshairHidden={!!view.vehicle}
      overlays={
        <>
          <InteractionPrompt prompt={view.prompt} progress={view.progress} />
          <DialogueBox line={view.dialogue} />
          <MissionObjective title={view.missionTitle} objective={view.objective} />
          <CityBannerView banner={view.banner} />
          {/* at the wheel a late tile simply appears: covering the road mid-drive would be worse */}
          {!view.isAreaReady && !view.vehicle && <GameLoadingScreen gameKind="city" message="Đang tải khu vực xung quanh…" />}
        </>
      }
      menus={
        <>
          {view.menu === 'map' && <CityBigMap view={view} onWaypoint={(at) => engine.current?.setWaypoint(at)} onClose={closeMenu} />}
          {view.menu === 'wheel' && <CharacterWheel heroes={view.heroes} onPick={(id) => engine.current?.switchHero(id)} onClose={closeMenu} />}
          {view.menu === 'shop' && view.shop && <ShopPanel shop={view.shop} money={view.money} onBuy={(id) => engine.current?.buyItem(id)} onClose={closeMenu} />}
        </>
      }
      touchActions={
        <>
          <button onClick={press('interact')}>F</button>
          <button onClick={press('map')}>BẢN ĐỒ</button>
          <button onClick={press('switchHero')}>NHÂN VẬT</button>
        </>
      }
      result={null}
    />
  );
}
