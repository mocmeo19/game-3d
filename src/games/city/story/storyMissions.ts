import type { Mission } from './missionTypes';

/**
 * The story of Thiên Lộc: Kha, a hired driver drowning in debt, Tú, a hacker who owes the Rắn Lục gang even more, and Lâm,
 * a pawnbroker who used to be a soldier for hire, end up robbing the gang that owns them all.
 */
export const STORY: readonly Mission[] = [
  {
    id: 'm1-last-ride', title: 'Chuyến xe cuối', protagonist: 'kha', start: 'hideout', reward: 500, requires: [],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Chú Tư', text: 'Kha, khách đặt một chiếc siêu xe đang nằm ở Bãi xe Quảng trường.' },
        { speaker: 'Chú Tư', text: 'Mang nó về đây. Trầy một vết là trừ vào nợ của mày.' },
        { speaker: 'Kha', text: 'Lần nào chú cũng nói vậy.' },
      ] },
      { kind: 'takeVehicle', place: 'plaza', vehicle: 'sports', text: 'Lấy siêu xe ở Bãi xe Quảng trường' },
      { kind: 'talk', lines: [{ speaker: 'Kha', text: 'Xe đẹp thật. Giao xong chuyến này là trả được nửa món nợ.' }] },
      { kind: 'deliver', place: 'hideout', text: 'Đưa siêu xe về Gara Xóm Nam' },
      { kind: 'talk', lines: [
        { speaker: 'Chú Tư', text: 'Gọn đấy. Nhưng có xe tuần tra theo mày về tới tận đây!' },
        { speaker: 'Kha', text: 'Để cháu dẫn chúng đi chỗ khác.' },
      ] },
      { kind: 'evade', stars: 1, text: 'Cắt đuôi cảnh sát' },
    ],
  },
  {
    id: 'm2-debt', title: 'Sổ nợ', protagonist: 'kha', start: 'hideout', reward: 900, requires: ['m1-last-ride'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Chú Tư', text: 'Bọn Rắn Lục chiếm cái kho của tao dưới Nút giao Xoắn.' },
        { speaker: 'Chú Tư', text: 'Trong đó có cuốn sổ nợ của cả khu này. Lấy nó về, tao xoá nợ cho mày.' },
      ] },
      { kind: 'goto', place: 'interchange', text: 'Đến Nút giao Xoắn' },
      { kind: 'eliminate', place: 'interchange', count: 4, weapon: 'glock', text: 'Hạ đám Rắn Lục giữ kho' },
      { kind: 'collect', place: 'interchange', item: 'Sổ nợ', text: 'Lấy cuốn sổ nợ' },
      { kind: 'evade', stars: 2, text: 'Thoát khỏi cảnh sát' },
      { kind: 'goto', place: 'hideout', text: 'Mang sổ nợ về gara' },
      { kind: 'talk', lines: [
        { speaker: 'Chú Tư', text: 'Xem này… có một cái tên nợ Rắn Lục còn nhiều hơn mày: Tú, dân máy tính.' },
        { speaker: 'Kha', text: 'Người nợ nhiều nhất thường biết nhiều nhất. Để cháu tìm người đó.' },
      ] },
    ],
  },
  {
    id: 'm3-ghost-signal', title: 'Tín hiệu ma', protagonist: 'tu', start: 'vyLoft', reward: 1200, requires: ['m2-debt'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Tú', text: 'Có người lái xe đến hỏi về món nợ của mình. Không hay rồi.' },
        { speaker: 'Tú', text: 'Máy chủ sổ sách của Rắn Lục đặt dưới Mái vòm. Xoá nợ thì phải tự tay làm.' },
      ] },
      { kind: 'goto', place: 'dome', text: 'Đến Mái vòm' },
      { kind: 'collect', place: 'dome', item: 'Thiết bị xâm nhập', text: 'Cắm thiết bị vào máy chủ' },
      { kind: 'talk', lines: [{ speaker: 'Tú', text: 'Vào được rồi… và còi báo động cũng kêu rồi!' }] },
      { kind: 'evade', stars: 2, text: 'Cắt đuôi cảnh sát' },
      { kind: 'goto', place: 'vyLoft', text: 'Về gác xép' },
    ],
  },
  {
    id: 'm4-hot-cargo', title: 'Hàng nóng', protagonist: 'tu', start: 'vyLoft', reward: 1500, requires: ['m3-ghost-signal'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Tú', text: 'Dữ liệu cho thấy một xe tải của Rắn Lục sắp rời Khu Hội chợ.' },
        { speaker: 'Tú', text: 'Bám sát nó tới khi tài xế bỏ chạy. Đừng để mất dấu.' },
      ] },
      { kind: 'chase', place: 'expo', vehicle: 'van', driver: 'Tài xế Rắn Lục', text: 'Bám sát xe tải' },
      { kind: 'deliver', place: 'jobGarage', text: 'Lái xe tải đến Bãi giao xe' },
      { kind: 'talk', lines: [
        { speaker: 'Tú', text: 'Toàn súng quân dụng. Ở thành phố này chỉ có một người dám mua chỗ hàng này.' },
        { speaker: 'Tú', text: 'Lâm, chủ tiệm cầm đồ phía tây. Mình sẽ gọi cho ông ấy.' },
      ] },
    ],
  },
  {
    id: 'm5-pawn-siege', title: 'Tiệm cầm đồ bị vây', protagonist: 'lam', start: 'pawnShop', reward: 1800, requires: ['m4-hot-cargo'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Lâm', text: 'Con bé Tú gọi bảo sẽ có khách tới. Khách tới rồi đây.' },
        { speaker: 'Lâm', text: 'Rắn Lục nghĩ tao giữ số súng đó. Cho chúng biết tay.' },
      ] },
      { kind: 'eliminate', place: 'pawnShop', count: 6, weapon: 'mp9', boss: 'Sẹo', text: 'Bảo vệ tiệm cầm đồ' },
      { kind: 'talk', lines: [{ speaker: 'Lâm', text: 'Chúng muốn chỗ súng đó đến thế thì mình cướp tiền của chúng trước.' }] },
    ],
  },
  {
    id: 'm6-crew', title: 'Lập nhóm', protagonist: 'kha', start: 'hideout', reward: 700, requires: ['m5-pawn-siege'],
    steps: [
      { kind: 'talk', lines: [{ speaker: 'Kha', text: 'Ông Lâm muốn gặp. Đến nơi bằng xe, có khi phải chạy gấp.' }] },
      { kind: 'goto', place: 'pawnShop', inVehicle: true, text: 'Lái xe đến Tiệm cầm đồ Lâm' },
      { kind: 'talk', lines: [
        { speaker: 'Lâm', text: 'Rắn Lục rửa tiền qua sòng bạc ngầm ở Nhà thi đấu tròn.' },
        { speaker: 'Lâm', text: 'Cần một tay lái, một tin tặc và một khẩu súng. Mày đi xem đường đi.' },
      ] },
      { kind: 'goto', place: 'arena', text: 'Thám thính Nhà thi đấu tròn' },
      { kind: 'talk', lines: [{ speaker: 'Kha', text: 'Lối thoát phía tây, hai chốt gác cửa bắc. Ghi nhận.' }] },
    ],
  },
  {
    id: 'm7-badge', title: 'Mượn xe tuần tra', protagonist: 'tu', start: 'vyLoft', reward: 2000, requires: ['m6-crew'],
    steps: [
      { kind: 'talk', lines: [{ speaker: 'Tú', text: 'Để qua chốt ở Nhà thi đấu, ta cần một xe tuần tra thật.' }] },
      { kind: 'takeVehicle', place: 'policeHq', vehicle: 'police', text: 'Lấy xe tuần tra ở Sở cảnh sát' },
      { kind: 'evade', stars: 3, text: 'Cắt đuôi cảnh sát' },
      { kind: 'deliver', place: 'hideout', text: 'Giấu xe tuần tra ở Gara Xóm Nam' },
    ],
  },
  {
    id: 'm8-arena-heist', title: 'Phi vụ Nhà thi đấu', protagonist: 'lam', start: 'pawnShop', reward: 6000, requires: ['m7-badge'],
    steps: [
      { kind: 'talk', lines: [{ speaker: 'Lâm', text: 'Kha chờ ở lối tây, Tú đã cắt camera. Đến lượt tao.' }] },
      { kind: 'goto', place: 'arena', text: 'Đến Nhà thi đấu tròn' },
      { kind: 'eliminate', place: 'arena', count: 7, weapon: 'm4a4', text: 'Hạ lính gác sòng bạc' },
      { kind: 'collect', place: 'arena', item: 'Túi tiền', text: 'Lấy túi tiền' },
      { kind: 'evade', stars: 3, text: 'Thoát khỏi cảnh sát' },
      { kind: 'goto', place: 'pawnShop', text: 'Mang tiền về tiệm cầm đồ' },
    ],
  },
  {
    id: 'm9-betrayal', title: 'Kẻ phản bội', protagonist: 'kha', start: 'hideout', reward: 3000, requires: ['m8-arena-heist'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Chú Tư', text: 'Kha… chú xin lỗi. Chúng bắt con gái chú. Chú đã khai hết.' },
        { speaker: 'Kha', text: 'Con bé ở đâu?' },
        { speaker: 'Chú Tư', text: 'Bờ sông Đông. Chúng đang chờ cháu ở đó.' },
      ] },
      { kind: 'goto', place: 'riverside', text: 'Đến Bờ sông Đông' },
      { kind: 'eliminate', place: 'riverside', count: 7, weapon: 'ak47', text: 'Phá ổ phục kích' },
      { kind: 'evade', stars: 2, text: 'Thoát khỏi cảnh sát' },
      { kind: 'talk', lines: [{ speaker: 'Kha', text: 'Con bé an toàn rồi. Giờ đến lượt Bà Trùm.' }] },
    ],
  },
  {
    id: 'm10-endgame', title: 'Hồi kết', protagonist: 'lam', start: 'pawnShop', reward: 15000, requires: ['m9-betrayal'],
    steps: [
      { kind: 'talk', lines: [
        { speaker: 'Lâm', text: 'Bà Trùm Hạc đang ở Trung tâm, giữa đám vệ sĩ của bà ta.' },
        { speaker: 'Tú', text: 'Tôi đã đưa sổ sách của bà ta cho báo chí. Hôm nay là ngày cuối của Rắn Lục.' },
      ] },
      { kind: 'goto', place: 'downtown', text: 'Đến Trung tâm' },
      { kind: 'eliminate', place: 'downtown', count: 9, weapon: 'm4a4', boss: 'Bà Trùm Hạc', text: 'Hạ Bà Trùm Hạc và vệ sĩ' },
      { kind: 'evade', stars: 4, text: 'Thoát khỏi vòng vây' },
      { kind: 'goto', place: 'hideout', text: 'Về Gara Xóm Nam' },
      { kind: 'talk', lines: [
        { speaker: 'Kha', text: 'Không còn nợ, không còn Rắn Lục.' },
        { speaker: 'Lâm', text: 'Còn lại một thành phố đầy người cần thuê tay lái giỏi.' },
        { speaker: 'Tú', text: 'Và một hacker biết hết bí mật của họ. Hẹn gặp ở phi vụ sau.' },
      ] },
    ],
  },
];

export const missionById = (id: string) => STORY.find((m) => m.id === id) ?? null;

/** Missions whose markers stand on the map: not passed yet, everything they need passed. */
export const availableMissions = (completed: ReadonlySet<string>) => STORY.filter((m) => !completed.has(m.id) && m.requires.every((r) => completed.has(r)));
