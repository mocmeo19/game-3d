# PUBG-Style Gun Combat Animation System

## 1. Tổng quan

Tài liệu mô tả các animation cần thiết để xây dựng hệ thống chiến đấu bằng súng
trong game 3D theo phong cách PUBG.

Hệ thống cần hỗ trợ:

- Di chuyển khi cầm súng (Locomotion).
- Ngắm và bắn súng (Aiming & Firing).
- Thay đạn (Reloading).
- Thay đổi tư thế (Combat Stances).
- Nghiêng người khi chiến đấu (Leaning).
- Trang bị và chuyển đổi vũ khí (Weapon Handling).
- Phản ứng khi trúng đạn và chết (Hit Reactions).
- Phối hợp animation bằng Blend Tree, Animation Layers và IK.
- Hỗ trợ góc nhìn thứ nhất (FPP) và góc nhìn thứ ba (TPP).

---

## 2. Danh sách Animation

### 2.1. Locomotion - Di chuyển khi cầm súng

Nhóm animation điều khiển chuyển động cơ bản của toàn bộ cơ thể.

| Animation | Mô tả | Ưu tiên |
|---|---|---|
| `Rifle_Idle` | Đứng yên, cầm súng | Bắt buộc |
| `Rifle_Walk_Fwd` | Đi về phía trước | Bắt buộc |
| `Rifle_Walk_Bwd` | Đi lùi | Bắt buộc |
| `Rifle_Walk_Left` | Đi ngang sang trái | Bắt buộc |
| `Rifle_Walk_Right` | Đi ngang sang phải | Bắt buộc |
| `Rifle_Run` | Chạy khi cầm súng | Bắt buộc |
| `Rifle_Sprint` | Chạy nước rút | Bắt buộc |
| `Rifle_Turn_Left` | Xoay người tại chỗ sang trái | Nâng cao |
| `Rifle_Turn_Right` | Xoay người tại chỗ sang phải | Nâng cao |
| `Rifle_Jump` | Nhảy khi cầm súng | Nên có |
| `Rifle_Land` | Tiếp đất sau khi nhảy | Nên có |

**Yêu cầu kỹ thuật:**

- Sử dụng Blend Tree hoặc Blend Space để phối hợp các hướng di chuyển.
- Hỗ trợ chuyển tiếp mượt giữa Idle, Walk, Run và Sprint.
- Tốc độ animation cần đồng bộ với tốc độ di chuyển thực tế.
- Hướng di chuyển có thể độc lập với hướng nhân vật đang ngắm.
- Có thể bổ sung di chuyển chéo bằng cách phối trộn các animation cơ bản.

### 2.2. Aiming & Firing - Ngắm và bắn súng

Nhóm animation quan trọng nhất của hệ thống chiến đấu.

| Animation | Mô tả | Ưu tiên |
|---|---|---|
| `Rifle_Aim_Enter` | Đưa súng lên ngắm | Bắt buộc |
| `Rifle_Aim_Idle` | Giữ súng trong tư thế ngắm | Bắt buộc |
| `Rifle_Aim_Exit` | Hạ súng khỏi tư thế ngắm | Bắt buộc |
| `Rifle_Fire_Hip` | Bắn không ngắm qua đầu ruồi | Bắt buộc |
| `Rifle_Fire_ADS` | Bắn khi đang ngắm ADS | Bắt buộc |
| `Rifle_Recoil` | Chuyển động giật súng khi bắn | Bắt buộc |
| `Rifle_Aim_Up` | Hướng súng lên trên | Aim Offset |
| `Rifle_Aim_Down` | Hướng súng xuống dưới | Aim Offset |
| `Rifle_Aim_Left` | Hướng súng sang trái | Aim Offset |
| `Rifle_Aim_Right` | Hướng súng sang phải | Aim Offset |
| `Rifle_Fire_LastBullet` | Bắn viên đạn cuối cùng | Tùy loại súng |
| `Rifle_DryFire` | Bóp cò khi súng hết đạn | Nên có |

**Yêu cầu kỹ thuật:**

- Hỗ trợ Hip Fire và Aim Down Sights (ADS).
- Chuyển tiếp mượt giữa trạng thái không ngắm và đang ngắm.
- Hỗ trợ Single Fire, Burst Fire và Automatic Fire.
- Recoil phải đồng bộ với từng phát bắn.
- Recoil có thể được triển khai bằng Additive Animation.
- Sử dụng Aim Offset để điều chỉnh hướng súng theo camera.
- Không cần animation riêng cho mỗi phát bắn khi bắn liên thanh.
- Camera recoil và weapon recoil nên được xử lý độc lập.
- Có thể bổ sung procedural animation để tạo chuyển động tự nhiên.

### 2.3. Reloading - Thay đạn

Nhóm animation điều khiển các thao tác thay đạn và lên đạn.

| Animation | Mô tả | Ưu tiên |
|---|---|---|
| `Rifle_Reload_Tactical` | Thay băng khi súng còn đạn | Bắt buộc |
| `Rifle_Reload_Empty` | Thay băng khi hết đạn | Bắt buộc |
| `Rifle_Reload_Crouch` | Thay đạn khi ngồi | Có thể tái sử dụng |
| `Rifle_Reload_Prone` | Thay đạn khi nằm | Nên có |
| `Rifle_Reload_Cancel` | Hủy thao tác thay đạn | Nên hỗ trợ |
| `Rifle_Bolt_Cycle` | Kéo khóa nòng để lên đạn | Tùy loại súng |
| `Shotgun_Load_Shell` | Nạp từng viên đạn shotgun | Tùy loại súng |

**Yêu cầu kỹ thuật:**

- Có thể thay đạn khi đứng, ngồi hoặc nằm.
- Có thể vừa di chuyển vừa thay đạn nếu gameplay cho phép.
- Phân biệt thay băng khi còn đạn và khi đã hết đạn.
- Hỗ trợ hủy reload khi chuyển vũ khí hoặc thực hiện hành động khác.
- Sử dụng Animation Events để đồng bộ thời điểm cập nhật đạn.
- Đồng bộ chuyển động băng đạn, khóa nòng và các bộ phận của súng.
- Hỗ trợ cơ chế thay đạn riêng cho từng loại vũ khí.

### 2.4. Combat Stances - Thay đổi tư thế

Nhân vật cần hỗ trợ ba tư thế chiến đấu chính:

- Standing: Đứng.
- Crouching: Ngồi.
- Prone: Nằm.

| Animation | Mô tả | Ưu tiên |
|---|---|---|
| `Stand_To_Crouch` | Chuyển từ đứng sang ngồi | Bắt buộc |
| `Crouch_Idle` | Ngồi yên và cầm súng | Bắt buộc |
| `Crouch_Walk` | Di chuyển khi ngồi | Bắt buộc |
| `Crouch_To_Stand` | Chuyển từ ngồi sang đứng | Bắt buộc |
| `Stand_To_Prone` | Chuyển từ đứng sang nằm | Bắt buộc |
| `Crouch_To_Prone` | Chuyển từ ngồi sang nằm | Nên có |
| `Prone_Idle` | Nằm yên và cầm súng | Bắt buộc |
| `Prone_Crawl_Fwd` | Bò về phía trước | Bắt buộc |
| `Prone_Crawl_Bwd` | Bò lùi | Nên có |
| `Prone_To_Stand` | Chuyển từ nằm sang đứng | Bắt buộc |
| `Prone_To_Crouch` | Chuyển từ nằm sang ngồi | Nên có |
| `Prone_Turn` | Xoay hướng khi đang nằm | Nâng cao |

**Yêu cầu kỹ thuật:**

- Hỗ trợ Aim, Fire và Reload trong các tư thế phù hợp.
- Chuyển đổi tư thế phải có animation transition.
- Collider và camera height cần thay đổi theo tư thế.
- Sử dụng Animation Layers để tái sử dụng animation bắn và ngắm.
- Có thể cần animation reload riêng khi nằm.
- Không nhất thiết phải tạo animation bắn riêng cho mọi tư thế.
- Cần giới hạn hướng ngắm và xoay cơ thể khi đang nằm.

### 2.5. Leaning - Nghiêng người khi chiến đấu

Cho phép nhân vật nghiêng sang trái hoặc phải để quan sát và bắn từ sau vật cản.

| Animation | Mô tả |
|---|---|
| `Lean_Left_Enter` | Bắt đầu nghiêng sang trái |
| `Lean_Left_Loop` | Giữ tư thế nghiêng trái |
| `Lean_Left_Exit` | Kết thúc nghiêng trái |
| `Lean_Right_Enter` | Bắt đầu nghiêng sang phải |
| `Lean_Right_Loop` | Giữ tư thế nghiêng phải |
| `Lean_Right_Exit` | Kết thúc nghiêng phải |

**Yêu cầu kỹ thuật:**

- Cho phép ngắm và bắn khi đang nghiêng.
- Có thể kết hợp Lean với Standing và Crouching.
- Sử dụng Additive Animation để phối hợp Lean với các animation khác.
- Điều chỉnh camera tương ứng với góc nghiêng.
- Weapon IK cần giữ cho tay và súng đúng vị trí.
- Kiểm tra va chạm để tránh camera hoặc súng xuyên qua vật cản.

### 2.6. Weapon Handling - Trang bị và chuyển súng

| Animation | Mô tả | Ưu tiên |
|---|---|---|
| `Rifle_Equip` | Lấy súng ra sử dụng | Bắt buộc |
| `Rifle_Unequip` | Cất súng | Bắt buộc |
| `Rifle_Switch` | Chuyển đổi giữa các khẩu súng | Nên có |
| `Rifle_Inspect` | Kiểm tra súng | Tùy chọn |
| `Rifle_Lower` | Hạ nòng súng | Nên có |
| `Rifle_Raise` | Đưa súng lên tư thế sẵn sàng | Nên có |

**Yêu cầu kỹ thuật:**

- Hỗ trợ chuyển đổi giữa súng chính, súng phụ và tay không.
- Đồng bộ thời điểm gắn hoặc tháo súng bằng Animation Events.
- Hỗ trợ vị trí gắn súng ở tay, lưng hoặc hông.
- Có thể sử dụng animation khác nhau theo từng nhóm vũ khí.
- Không cho phép bắn khi trạng thái Equip chưa hoàn tất nếu gameplay yêu cầu.

### 2.7. Hit Reactions - Trúng đạn và chết

| Animation | Mô tả |
|---|---|
| `Hit_Front` | Phản ứng khi trúng đạn phía trước |
| `Hit_Back` | Phản ứng khi trúng đạn phía sau |
| `Hit_Left` | Phản ứng khi trúng đạn bên trái |
| `Hit_Right` | Phản ứng khi trúng đạn bên phải |
| `Knockdown` | Nhân vật bị hạ gục |
| `Knocked_Idle` | Nằm trong trạng thái bị hạ gục |
| `Knocked_Crawl` | Bò khi bị hạ gục |
| `Death` | Nhân vật chết |

**Yêu cầu kỹ thuật:**

- Hướng phản ứng phải phụ thuộc vào hướng nhận sát thương.
- Có thể sử dụng Additive Animation để tránh gián đoạn hoàn toàn việc bắn.
- Hỗ trợ trạng thái bị hạ gục trong chế độ chơi đồng đội.
- Có thể chuyển từ Death Animation sang Ragdoll Physics.
- Khi nhân vật chết, phải vô hiệu hóa các hành động chiến đấu.

---

## 3. Animation Architecture

### 3.1. Phân chia Animation Layers

Không nên xây dựng một animation riêng cho mọi tổ hợp trạng thái.

Thay vào đó, sử dụng nhiều layer để phối hợp các chuyển động.

#### Base Locomotion Layer

Điều khiển chuyển động chính của cơ thể:

- Idle.
- Walk.
- Run.
- Sprint.
- Jump.
- Crouch.
- Prone.

#### Upper Body Layer

Điều khiển chuyển động của phần thân trên:

- Aim.
- Fire.
- Reload.
- Equip.
- Unequip.

#### Additive Layer

Bổ sung các chuyển động phụ:

- Recoil.
- Lean.
- Aim Offset.
- Breathing.
- Weapon Sway.
- Hit Reaction.

#### IK Layer

Điều chỉnh vị trí các bộ phận cơ thể:

- Left Hand IK.
- Right Hand IK.
- Weapon IK.
- Foot IK.
- Look At IK.

### 3.2. Thứ tự phối hợp Animation

1. Xác định tư thế và trạng thái di chuyển.
2. Lấy kết quả từ Base Locomotion Layer.
3. Phối hợp Upper Body Layer bằng Bone Mask hoặc Layered Blend.
4. Áp dụng Recoil, Lean và Aim Offset.
5. Áp dụng IK để điều chỉnh vị trí tay, chân và vũ khí.
6. Xuất Final Character Pose.

### 3.3. Ví dụ phối hợp Animation

**Tình huống:** Nhân vật đi ngang sang trái, nghiêng người và bắn súng.

| Layer | Animation |
|---|---|
| Base Locomotion | `Walk_Left` |
| Upper Body | `Aim_Idle` |
| Additive | `Lean_Left` + `Recoil` |
| IK | `Left_Hand_IK` + `Weapon_IK` |

Kết quả là nhân vật có thể thực hiện đồng thời nhiều hành động mà không cần tạo
animation riêng như `Walk_Left_Lean_Left_Aim_Fire`.

---

## 4. Animation theo từng loại súng

Các nhóm vũ khí có thể dùng chung locomotion nhưng cần animation thao tác súng khác nhau.

### 4.1. Assault Rifle (AR)

Ví dụ: M416, AKM.

- Rifle Idle.
- Rifle Aim.
- Rifle Fire.
- Rifle Recoil.
- Magazine Reload.
- Charging Handle Animation.

### 4.2. Submachine Gun (SMG)

Ví dụ: UMP, Vector.

- SMG Idle.
- SMG Aim.
- SMG Fire.
- SMG Recoil.
- SMG Reload.

### 4.3. Designated Marksman Rifle (DMR)

Ví dụ: SKS, SLR.

- DMR Idle.
- DMR Aim.
- DMR Fire.
- DMR Recoil.
- DMR Reload.

### 4.4. Sniper Rifle

Ví dụ: Kar98k, M24.

- Sniper Idle.
- Sniper Aim.
- Sniper Fire.
- Sniper Recoil.
- Bolt Cycle.
- Sniper Reload.

### 4.5. Shotgun

Ví dụ: S1897, S686.

- Shotgun Idle.
- Shotgun Aim.
- Shotgun Fire.
- Shotgun Recoil.
- Pump Action hoặc Break Action.
- Shell Reload.

### 4.6. Pistol

Ví dụ: P92, P1911.

- Pistol Equip.
- Pistol Idle.
- Pistol Aim.
- Pistol Fire.
- Pistol Recoil.
- Pistol Reload.
- Slide Animation.

### 4.7. Chiến lược tái sử dụng Animation

Nên xây dựng các animation theo nhóm vũ khí thay vì từng khẩu súng.

Các thành phần có thể tái sử dụng:

- Locomotion.
- Aim Offset.
- Lean.
- Crouch.
- Prone.
- Hit Reaction.
- Death.

Các thành phần thường cần tùy chỉnh:

- Weapon Idle Pose.
- Fire.
- Recoil.
- Reload.
- Equip.
- Bolt hoặc Slide Animation.
- Weapon IK Position.

---

## 5. Minimum Viable Product (MVP)

Phiên bản đầu tiên nên tập trung hoàn thiện một khẩu Assault Rifle.

### 5.1. Locomotion

- [ ] `Idle`
- [ ] `Walk_Forward`
- [ ] `Walk_Backward`
- [ ] `Walk_Left`
- [ ] `Walk_Right`
- [ ] `Run`
- [ ] `Sprint`

### 5.2. Weapon Combat

- [ ] `Aim_Enter`
- [ ] `Aim_Idle`
- [ ] `Aim_Exit`
- [ ] `Fire_Hip`
- [ ] `Fire_ADS`
- [ ] `Recoil`
- [ ] `Reload_Tactical`
- [ ] `Reload_Empty`
- [ ] `Equip`
- [ ] `Unequip`

### 5.3. Combat Stances

- [ ] `Stand_To_Crouch`
- [ ] `Crouch_Idle`
- [ ] `Crouch_Walk`
- [ ] `Crouch_To_Stand`
- [ ] `Stand_To_Prone`
- [ ] `Prone_Idle`
- [ ] `Prone_Crawl`
- [ ] `Prone_To_Stand`

### 5.4. Combat Impact

- [ ] `Hit_Reaction`
- [ ] `Death`

### 5.5. Animation System

- [ ] Locomotion Blend Tree.
- [ ] Upper Body Animation Layer.
- [ ] Aim Offset.
- [ ] Additive Recoil.
- [ ] Weapon IK.
- [ ] Animation State Machine.
- [ ] Animation Transition.
- [ ] Animation Events.

---

## 6. Các hệ thống Gameplay liên quan

Animation không trực tiếp thay thế logic của hệ thống súng.

Một hệ thống chiến đấu hoàn chỉnh cần các thành phần sau:

| Hệ thống | Chức năng |
|---|---|
| Weapon State Machine | Quản lý trạng thái vũ khí |
| Fire Controller | Điều khiển Single, Burst và Auto |
| Ballistics | Raycast, Projectile và sát thương |
| Recoil Controller | Điều khiển độ giật súng và camera |
| ADS Controller | Điều khiển camera và hướng ngắm |
| IK Controller | Điều chỉnh tay và vị trí súng |
| Magazine System | Quản lý đạn và thay đạn |
| Animation Events | Đồng bộ hành động với gameplay |
| VFX System | Muzzle Flash, khói và vỏ đạn |
| SFX System | Tiếng súng, thay đạn và lên đạn |
| Multiplayer Sync | Đồng bộ trạng thái qua mạng |

### 6.1. Weapon State Machine

Các trạng thái đề xuất:

- `UNARMED`: Không trang bị súng.
- `EQUIPPING`: Đang lấy súng.
- `READY`: Sẵn sàng sử dụng.
- `AIMING`: Đang ngắm.
- `FIRING`: Đang bắn.
- `RELOADING`: Đang thay đạn.
- `UNEQUIPPING`: Đang cất súng.
- `DISABLED`: Không thể sử dụng súng.

Các trạng thái vũ khí có thể kết hợp với trạng thái di chuyển và tư thế.

### 6.2. Đồng bộ Animation và Gameplay

- Gameplay Controller quyết định khi nào được phép bắn.
- Animation Controller quyết định animation cần phát.
- Animation Events đồng bộ các thao tác quan trọng.
- Logic sát thương không nên phụ thuộc hoàn toàn vào animation.
- Trong multiplayer, server cần xác thực các hành động và kết quả bắn.

---

## 7. Hỗ trợ FPP và TPP

Game có cả góc nhìn thứ nhất và thứ ba nên cân nhắc hai bộ animation.

### 7.1. Third-Person Perspective (TPP)

- Animation toàn thân.
- Locomotion theo nhiều hướng.
- Aim Offset.
- Upper Body Layer.
- Lean.
- Reload.
- Weapon IK.
- Foot IK.
- Hit Reaction và Death.

### 7.2. First-Person Perspective (FPP)

- Animation tay và súng có độ chi tiết cao.
- Aim Down Sights.
- Fire Recoil.
- Reload.
- Weapon Equip.
- Weapon Sway.
- Breathing.
- Camera Motion.

Có thể sử dụng animation riêng cho FPP để tối ưu cảm giác bắn súng.

Trạng thái gameplay phải thống nhất giữa FPP và TPP.

---

## 8. Lộ trình triển khai

### Phase 1 - Basic Weapon Combat

**Mục tiêu:** Nhân vật có thể di chuyển và sử dụng một khẩu súng.

- Triển khai Locomotion.
- Triển khai Equip và Unequip.
- Triển khai Hip Fire và ADS.
- Triển khai Fire và Recoil.
- Triển khai Reload.
- Triển khai Weapon State Machine.

### Phase 2 - Tactical Combat

**Mục tiêu:** Hoàn thiện các thao tác chiến đấu chiến thuật.

- Triển khai Crouch.
- Triển khai Prone.
- Triển khai Lean.
- Triển khai Aim Offset.
- Triển khai Upper Body Animation Layer.
- Triển khai Weapon IK.

### Phase 3 - Weapon Expansion

**Mục tiêu:** Hỗ trợ nhiều nhóm vũ khí.

- Assault Rifle.
- SMG.
- DMR.
- Sniper Rifle.
- Shotgun.
- Pistol.

### Phase 4 - Advanced Combat

**Mục tiêu:** Cải thiện độ chân thực và phản hồi chiến đấu.

- Directional Hit Reaction.
- Knockdown.
- Death và Ragdoll.
- Advanced Recoil.
- Procedural Weapon Sway.
- Foot IK.
- Animation Transition Optimization.

### Phase 5 - Multiplayer Integration

**Mục tiêu:** Đồng bộ hệ thống chiến đấu qua mạng.

- Đồng bộ Weapon State.
- Đồng bộ Aim Direction.
- Đồng bộ Fire Event.
- Đồng bộ Reload State.
- Đồng bộ Combat Stance.
- Đồng bộ Hit Reaction.
- Server-side Hit Validation.
- Network Animation Interpolation.

---

## 9. Nguyên tắc thiết kế

1. Không tạo animation riêng cho mọi tổ hợp hành động.
2. Ưu tiên tái sử dụng animation bằng Blend Tree và Animation Layers.
3. Tách Gameplay State Machine khỏi Animation State Machine.
4. Sử dụng Additive Animation cho Recoil, Lean và Aim Offset.
5. Sử dụng IK để đảm bảo tay luôn giữ đúng vị trí trên súng.
6. Sử dụng Animation Events để đồng bộ thao tác với gameplay.
7. Xây dựng một loại súng hoàn chỉnh trước khi mở rộng.
8. Tái sử dụng locomotion cho nhiều loại súng khi phù hợp.
9. Tối ưu transition để tránh giật hoặc ngắt chuyển động.
10. Thiết kế kiến trúc hỗ trợ cả FPP, TPP và multiplayer.

## 10. Kết luận

Hệ thống animation chiến đấu bằng súng theo phong cách PUBG nên được xây dựng
theo kiến trúc phân lớp thay vì phụ thuộc vào số lượng animation riêng lẻ.

Các thành phần cốt lõi gồm:

- Base Locomotion.
- Upper Body Animation.
- Additive Animation.
- Aim Offset.
- Inverse Kinematics.
- Animation State Machine.
- Weapon State Machine.
- Animation Events.

**Ưu tiên triển khai:** Locomotion → Aim → Fire → Reload → Crouch → Prone → Lean.

Sau khi hoàn thiện hệ thống cho một khẩu Assault Rifle, có thể mở rộng sang
các loại súng khác mà không cần xây dựng lại toàn bộ kiến trúc animation.