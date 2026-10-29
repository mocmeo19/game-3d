/**
 * Illustrative hero-profile content for the home screen (skills and stats per class).
 * These are placeholders written for this app, not data from the original game.
 */

export interface HeroSkill {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

type Raw = [string, string, string];

const mk = (prefix: string, rows: Raw[]): HeroSkill[] => rows.map(([icon, name, desc], i) => ({ id: `${prefix}${i + 1}`, icon, name, desc }));

export const CLASS_SKILLS: Record<string, { field: HeroSkill[]; tactics: HeroSkill[] }> = {
  blade_master: {
    field: mk('bm_f', [
      ['⚡', 'Rút kiếm Sét', 'Rút kiếm cực nhanh, gây sát thương sấm sét lên kẻ địch phía trước.'],
      ['🛡️', 'Thế thủ Thép', 'Dựng thế phòng thủ, chặn và phản đòn các đòn cận chiến.'],
      ['🔥', 'Kiếm Hỏa Long', 'Chém xoáy bằng lửa, gây sát thương diện rộng.']
    ]),
    tactics: mk('bm_t', [
      ['📣', 'Hiệu lệnh tiên phong', 'Tăng sức tấn công cho đồng đội trong tầm.'],
      ['🌀', 'Bước chân gió', 'Tăng tốc độ di chuyển của cả đội.'],
      ['🏯', 'Trận kiếm', 'Tạo vùng kiếm khí kiểm soát chiến trường.']
    ])
  },
  kung_fu_master: {
    field: mk('kf_f', [
      ['🥊', 'Liên hoàn quyền', 'Chuỗi đấm tốc độ cao dồn dập vào một mục tiêu.'],
      ['🌪️', 'Gạt đòn', 'Gạt đòn tấn công rồi phản công bằng đòn vật.'],
      ['💥', 'Giáng đất', 'Đòn kết liễu giáng xuống đất, làm kẻ địch choáng.']
    ]),
    tactics: mk('kf_t', [
      ['🐉', 'Hơi thở rồng', 'Phun luồng khí nóng làm chậm kẻ địch.'],
      ['🔥', 'Nội công', 'Tăng tốc độ ra đòn trong thời gian ngắn.'],
      ['🧘', 'Tĩnh tâm', 'Hồi phục sinh lực dần dần cho đồng đội.']
    ])
  },
  force_master: {
    field: mk('fm_f', [
      ['❄️', 'Băng phong', 'Phong ấn kẻ địch trong lớp băng cứng.'],
      ['☄️', 'Cầu lửa', 'Phóng quả cầu lửa nổ lan trên diện rộng.'],
      ['🔮', 'Vòng khí', 'Triệu hồi vòng khí âm dương quay quanh người.']
    ]),
    tactics: mk('fm_t', [
      ['🌌', 'Mưa sao', 'Trút mưa năng lượng lên một vùng.'],
      ['🧊', 'Vách băng', 'Dựng bức tường băng chặn đường địch.'],
      ['✨', 'Hồi khí', 'Hồi nội lực cho cả đội.']
    ])
  },
  destroyer: {
    field: mk('ds_f', [
      ['🪓', 'Quật rìu', 'Tóm kẻ địch rồi quật mạnh xuống đất.'],
      ['🌀', 'Lốc xoáy sắt', 'Xoay rìu thành cơn lốc hủy diệt.'],
      ['🪨', 'Địa chấn', 'Dậm đất tạo sóng chấn động lan rộng.']
    ]),
    tactics: mk('ds_t', [
      ['🛡️', 'Da sắt', 'Giảm sát thương nhận vào cho đồng đội phía sau.'],
      ['😤', 'Khiêu khích', 'Thu hút sự chú ý của kẻ địch về phía mình.'],
      ['⛰️', 'Kiên cố', 'Tăng khả năng chịu đòn trong một thời gian.']
    ])
  },
  assassin: {
    field: mk('as_f', [
      ['🗡️', 'Đâm lén', 'Đòn đâm từ phía sau với sát thương cực cao.'],
      ['💨', 'Bước bóng sương', 'Biến mất trong làn khói và xuất hiện sau lưng địch.'],
      ['☠️', 'Bẫy độc', 'Đặt bẫy độc làm kẻ địch mất sinh lực dần.']
    ]),
    tactics: mk('as_t', [
      ['🌑', 'Màn đêm', 'Giảm tầm nhìn của kẻ địch.'],
      ['🌫️', 'Khói che', 'Giúp đồng đội ẩn thân trong chốc lát.'],
      ['🎯', 'Điểm yếu', 'Đánh dấu mục tiêu để nhận thêm sát thương.']
    ])
  },
  summoner: {
    field: mk('sm_f', [
      ['🌻', 'Mưa hoa mặt trời', 'Gọi những đóa hoa nổ tung rơi xuống kẻ địch.'],
      ['🐱', 'Mèo linh', 'Ra lệnh cho thú triệu hồi tấn công mục tiêu.'],
      ['🌿', 'Ôm thiên nhiên', 'Dây leo trói chân kẻ địch.']
    ]),
    tactics: mk('sm_t', [
      ['🍃', 'Phước lành', 'Hồi sinh lực nhẹ cho cả đội.'],
      ['🌸', 'Hoa hồi sinh', 'Trồng đóa hoa hồi phục tại vị trí chỉ định.'],
      ['🦋', 'Bướm linh', 'Tăng tốc độ di chuyển cho đồng đội.']
    ])
  },
  gunslinger: {
    field: mk('gs_f', [
      ['🔫', 'Xả đạn lửa', 'Xả loạt đạn cháy từ hai khẩu súng lục.'],
      ['🪝', 'Đu dây móc', 'Bắn dây móc để lao đến vị trí mới.'],
      ['⏱️', 'Thời gian chậm', 'Làm chậm thời gian để bắn chính xác.']
    ]),
    tactics: mk('gs_t', [
      ['💣', 'Đạn nổ', 'Bắn đạn nổ gây sát thương diện rộng.'],
      ['🎩', 'Phong thái xạ thủ', 'Tăng tỉ lệ chí mạng cho cả đội.'],
      ['🏜️', 'Cơn gió sa mạc', 'Tăng tốc độ ra đòn tầm xa.']
    ])
  },
  blade_dancer: {
    field: mk('bd_f', [
      ['🌪️', 'Lốc kiếm', 'Xoay người chém liên tục mọi kẻ địch xung quanh.'],
      ['⚡', 'Lôi trảm', 'Lướt tới và chém một đường kiếm sét.'],
      ['🌙', 'Nguyệt bộ', 'Lùi về sau trong nháy mắt, né mọi đòn đánh.']
    ]),
    tactics: mk('bd_t', [
      ['🍃', 'Phong vũ', 'Tăng tốc độ di chuyển cho cả đội.'],
      ['🎐', 'Kiếm trận gió', 'Tạo vùng gió làm kẻ địch chậm lại.'],
      ['✨', 'Tâm kiếm', 'Tăng chí mạng cho đồng đội trong tầm.']
    ])
  },
  warlock: {
    field: mk('wl_f', [
      ['📜', 'Phóng bùa', 'Ném loạt bùa chú phát nổ vào mục tiêu.'],
      ['🌑', 'Hố đen', 'Mở hố bóng tối hút kẻ địch vào giữa.'],
      ['🔗', 'Xích ấn', 'Trói kẻ địch bằng xích phù văn.']
    ]),
    tactics: mk('wl_t', [
      ['🕯️', 'Linh hồn hộ mệnh', 'Che chắn đồng đội bằng linh hồn.'],
      ['☯️', 'Ấn phong', 'Phong ấn khả năng của kẻ địch trong vùng.'],
      ['💜', 'Hồi hồn', 'Hồi nội lực cho cả đội.']
    ])
  },
  soul_fighter: {
    field: mk('sf_f', [
      ['👊', 'Hồn quyền', 'Đấm liên hoàn mang theo hồn khí.'],
      ['🌀', 'Chưởng phong', 'Phóng chưởng khí đẩy lùi kẻ địch.'],
      ['🪨', 'Địa chưởng', 'Đập chưởng xuống đất tạo sóng chấn.']
    ]),
    tactics: mk('sf_t', [
      ['💚', 'Hồi sinh khí', 'Hồi sinh lực cho đồng đội xung quanh.'],
      ['🧊', 'Băng chưởng', 'Đóng băng kẻ địch trước mặt.'],
      ['🧘', 'Tụ khí', 'Tích khí để tăng sức mạnh đòn sau.']
    ])
  },
  warden: {
    field: mk('wd_f', [
      ['🗡️', 'Trọng trảm', 'Vung đại kiếm chém ngang cực mạnh.'],
      ['🛡️', 'Thủ thành', 'Dựng kiếm chắn đòn cho cả đội phía sau.'],
      ['❄️', 'Băng kiếm', 'Cắm kiếm xuống đất tạo vùng băng.']
    ]),
    tactics: mk('wd_t', [
      ['⚡', 'Lôi trận', 'Gọi sấm sét đánh xuống quanh mình.'],
      ['😤', 'Khiêu chiến', 'Thu hút kẻ địch tấn công mình.'],
      ['⛰️', 'Bất động', 'Miễn bị đẩy lùi trong một thời gian.']
    ])
  },
  archer: {
    field: mk('ar_f', [
      ['🏹', 'Tiễn tích lực', 'Kéo căng dây cung rồi bắn mũi tên xuyên thấu.'],
      ['🌧️', 'Mưa tên', 'Bắn mưa tên xuống một vùng.'],
      ['💨', 'Phong tiễn', 'Mũi tên gió đẩy lùi kẻ địch.']
    ]),
    tactics: mk('ar_t', [
      ['🦅', 'Ưng nhãn', 'Tăng tầm bắn và chí mạng cho đội.'],
      ['🪤', 'Bẫy tên', 'Đặt bẫy làm kẻ địch đứng yên.'],
      ['🍃', 'Bước gió', 'Nhảy lùi và tăng tốc độ di chuyển.']
    ])
  },
  astromancer: {
    field: mk('am_f', [
      ['🌠', 'Mưa sao băng', 'Giáng mưa sao băng xuống kẻ địch.'],
      ['🔭', 'Tinh quỹ', 'Các vì sao xoay quanh và bắn vào mục tiêu.'],
      ['☄️', 'Sao chổi', 'Phóng sao chổi lửa xuyên qua hàng địch.']
    ]),
    tactics: mk('am_t', [
      ['🌌', 'Tinh vân', 'Tạo vùng ánh sao hồi phục đồng đội.'],
      ['🛡️', 'Tinh giáp', 'Bọc đồng đội trong lá chắn sao.'],
      ['✨', 'Tinh lực', 'Tăng sức tấn công cho cả đội.']
    ])
  },
  dual_blade: {
    field: mk('db_f', [
      ['⚔️', 'Song trảm', 'Hai lưỡi kiếm chém chéo liên tiếp.'],
      ['🌀', 'Chong chóng kiếm', 'Xoay người như lốc, chém mọi hướng.'],
      ['🌑', 'Ảnh bộ', 'Biến mất và xuất hiện sau lưng kẻ địch.']
    ]),
    tactics: mk('db_t', [
      ['🩸', 'Xuất huyết', 'Vết chém làm kẻ địch mất máu dần.'],
      ['🌫️', 'Màn khói', 'Che giấu cả đội trong làn khói.'],
      ['🎯', 'Truy sát', 'Đánh dấu và tăng sát thương lên mục tiêu.']
    ])
  },
  musician: {
    field: mk('mu_f', [
      ['🎵', 'Hùng ca', 'Khúc nhạc tăng sức tấn công cho cả đội.'],
      ['🎶', 'Bi ca', 'Âm điệu làm kẻ địch chậm và yếu đi.'],
      ['💥', 'Âm chấn', 'Gảy mạnh tạo sóng âm đẩy lùi kẻ địch.']
    ]),
    tactics: mk('mu_t', [
      ['💖', 'Khúc hồi xuân', 'Hồi sinh lực dần cho đồng đội.'],
      ['🌬️', 'Phong khúc', 'Tăng tốc độ di chuyển của cả đội.'],
      ['🎼', 'Đại hợp tấu', 'Tăng mọi chỉ số cho đồng đội trong thời gian ngắn.']
    ])
  }
};

export type StatKey = 'hp' | 'atk' | 'def' | 'crit' | 'spd' | 'mp';

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'Sinh lực',
  atk: 'Công kích',
  def: 'Phòng thủ',
  crit: 'Chí mạng',
  spd: 'Tốc độ',
  mp: 'Nội lực'
};

const BASE: Record<string, Record<StatKey, number>> = {
  blade_master: { hp: 78, atk: 72, def: 66, crit: 58, spd: 62, mp: 52 },
  kung_fu_master: { hp: 82, atk: 76, def: 60, crit: 64, spd: 72, mp: 48 },
  force_master: { hp: 56, atk: 80, def: 44, crit: 62, spd: 56, mp: 88 },
  destroyer: { hp: 94, atk: 78, def: 86, crit: 40, spd: 42, mp: 36 },
  assassin: { hp: 58, atk: 84, def: 40, crit: 88, spd: 84, mp: 46 },
  summoner: { hp: 60, atk: 58, def: 50, crit: 46, spd: 60, mp: 84 },
  gunslinger: { hp: 62, atk: 82, def: 46, crit: 74, spd: 76, mp: 54 },
  blade_dancer: { hp: 66, atk: 80, def: 50, crit: 74, spd: 86, mp: 50 },
  warlock: { hp: 58, atk: 78, def: 46, crit: 60, spd: 58, mp: 90 },
  soul_fighter: { hp: 76, atk: 74, def: 58, crit: 62, spd: 66, mp: 70 },
  warden: { hp: 92, atk: 74, def: 84, crit: 44, spd: 46, mp: 40 },
  archer: { hp: 60, atk: 84, def: 44, crit: 80, spd: 74, mp: 52 },
  astromancer: { hp: 58, atk: 72, def: 50, crit: 58, spd: 60, mp: 92 },
  dual_blade: { hp: 60, atk: 82, def: 42, crit: 86, spd: 88, mp: 44 },
  musician: { hp: 62, atk: 56, def: 52, crit: 50, spd: 62, mp: 92 }
};

export const RACE_MOD: Record<string, Partial<Record<StatKey, number>>> = {
  jin: {},
  gon: { atk: 6, def: 6, hp: 4, spd: -6 },
  lyn: { spd: 8, atk: -4, mp: 6 },
  yun: { crit: 6, spd: 4, def: -4 }
};

export const heroStats = (cls: string, race: string): { stats: Record<StatKey, number>; power: number } => {
  const base = BASE[cls] ?? BASE.blade_master;
  const mod = RACE_MOD[race] ?? {};
  const stats = {} as Record<StatKey, number>;
  (Object.keys(base) as StatKey[]).forEach((k) => {
    stats[k] = Math.max(1, Math.min(100, base[k] + (mod[k] ?? 0)));
  });
  const power = Math.round((stats.hp * 0.6 + stats.atk * 1.4 + stats.def * 0.9 + stats.crit * 0.8 + stats.spd * 0.5 + stats.mp * 0.6) * 38);
  return { stats, power };
};
