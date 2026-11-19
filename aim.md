# PUBG-Style Aiming System - FPP & TPP

## 1. Tổng quan

Tài liệu mô tả cách xây dựng hệ thống ngắm súng (Aiming System) trong game 3D
theo phong cách PUBG, hỗ trợ hai góc nhìn:

- **FPP (First-Person Perspective):** Góc nhìn thứ nhất.
- **TPP (Third-Person Perspective):** Góc nhìn thứ ba.

Hệ thống cần hỗ trợ các chức năng:

- Chuyển đổi giữa FPP và TPP.
- Ngắm bình thường (Hip Fire).
- Ngắm qua vai (Shoulder Aim).
- Ngắm qua đầu ruồi hoặc ống ngắm (ADS).
- Điều khiển camera khi ngắm.
- Điều khiển hướng súng theo camera.
- Tính toán hướng đạn từ nòng súng.
- Phối hợp animation khi ngắm và bắn.
- Điều chỉnh Aim Offset và Weapon IK.
- Hỗ trợ ngắm khi đứng, ngồi, nằm và nghiêng người.
- Xử lý vật cản giữa camera, súng và mục tiêu.

---

## 2. Các chế độ ngắm

### 2.1. FPP - First-Person Perspective

Camera được đặt tại vị trí mắt của nhân vật.

**Đặc điểm:**

- Camera di chuyển và xoay theo hướng nhìn của người chơi.
- Hiển thị tay và súng ở phía trước camera.
- Có thể sử dụng bộ animation tay và súng riêng.
- Súng có thể ở trạng thái Hip Fire hoặc ADS.
- Tâm màn hình được sử dụng để xác định hướng ngắm.
- Hướng bắn được tính toán dựa trên camera và vị trí nòng súng.

**Khi Hip Fire:**

- Camera giữ FOV mặc định.
- Súng nằm ở vị trí cầm bình thường.
- Hiển thị crosshair.
- Độ chính xác phụ thuộc vào trạng thái di chuyển và loại súng.

**Khi ADS:**

- Camera hoặc mô hình súng được căn chỉnh để nhìn qua đầu ruồi hoặc scope.
- FOV thay đổi theo loại ống ngắm.
- Sử dụng animation `Aim_Enter` và `Aim_Idle`.
- Crosshair thông thường được ẩn hoặc thay bằng reticle.
- Độ chính xác và tốc độ di chuyển được điều chỉnh theo cấu hình súng.

### 2.2. TPP - Third-Person Perspective

Camera nằm phía sau nhân vật và thường lệch sang một bên vai.

**Đặc điểm:**

- Camera hiển thị toàn bộ cơ thể nhân vật.
- Camera có thể xoay quanh nhân vật.
- Hướng camera và hướng cơ thể có thể khác nhau.
- Hướng di chuyển có thể độc lập với hướng nhìn.
- Súng được điều khiển bằng animation và IK.
- Cần xử lý chênh lệch giữa vị trí camera và nòng súng.

**Khi Hip Fire:**

- Camera giữ khoảng cách thông thường.
- Nhân vật cầm súng ở tư thế sẵn sàng.
- Hiển thị crosshair ở tâm màn hình.
- Cho phép di chuyển và quan sát xung quanh.

**Khi Shoulder Aim:**

- Camera tiến gần nhân vật.
- Camera chuyển đến vị trí gần vai.
- FOV có thể giảm nhẹ.
- Nhân vật nâng súng lên tư thế ngắm.
- Thân trên được xoay theo hướng camera.
- Hỗ trợ di chuyển trong khi ngắm.

**Khi ADS:**

- Camera chuyển sang vị trí ngắm qua đầu ruồi hoặc scope.
- Sử dụng ADS Animation.
- Căn chỉnh trục ngắm của súng với hướng nhìn.
- Có thể sử dụng cách hiển thị tương tự FPP.
- Khi thoát ADS, camera trở về chế độ TPP trước đó.

### 2.3. ADS - Aim Down Sights

ADS là trạng thái ngắm chính xác bằng đầu ruồi hoặc ống ngắm.

**Đặc điểm:**

- Camera được căn chỉnh với trục ngắm của vũ khí.
- Sử dụng `SightSocket` để xác định vị trí ngắm.
- FOV phụ thuộc vào loại scope.
- Có thể giảm tốc độ di chuyển.
- Sử dụng animation riêng cho ADS.
- Hỗ trợ bắn trong khi đang ADS.
- Hỗ trợ điều chỉnh hướng ngắm bằng Aim Offset.

ADS có thể được kích hoạt từ cả FPP và TPP.

---

## 3. Camera System

### 3.1. Các trạng thái Camera

| Camera Mode | Mô tả |
|---|---|
| `FPP_HIP` | Camera góc nhìn thứ nhất |
| `TPP_HIP` | Camera góc nhìn thứ ba |
| `TPP_SHOULDER` | Camera ngắm qua vai |
| `ADS` | Camera ngắm qua đầu ruồi hoặc scope |

### 3.2. Camera Configuration

| Thuộc tính | FPP | TPP | ADS |
|---|---|---|---|
| Position | Eye Socket | Behind Shoulder | Sight Axis |
| Distance | Gần 0 | 2-4 m | Gần 0 |
| FOV | 80-100° | 80-100° | Theo Scope |
| Character | Arms / Weapon | Full Body | Weapon / Scope |
| Crosshair | Có | Có | Reticle |
| Animation | FPP Arms | Full Body | ADS Pose |

Các thông số là giá trị tham khảo và có thể thay đổi theo thiết kế game.

### 3.3. Camera Transition

Khi thay đổi chế độ ngắm, camera cần chuyển đổi mượt mà.

**Quy trình:**

1. Nhận yêu cầu thay đổi chế độ ngắm.
2. Kiểm tra trạng thái nhân vật và vũ khí.
3. Xác định Camera Mode đích.
4. Lấy vị trí và góc xoay camera đích.
5. Nội suy vị trí camera.
6. Nội suy FOV.
7. Đồng bộ animation nhân vật.
8. Hoàn thành chuyển đổi.

**Yêu cầu:**

- Không thay đổi camera đột ngột.
- Giữ nguyên hướng nhìn khi chuyển FPP và TPP.
- Không làm thay đổi mục tiêu đang ngắm ngoài ý muốn.
- Thời gian transition có thể cấu hình theo từng loại súng.
- Hỗ trợ hủy transition khi người chơi thay đổi hành động.

### 3.4. Camera Collision

TPP Camera cần xử lý va chạm với môi trường.

**Yêu cầu:**

- Không cho camera xuyên qua tường.
- Khi gặp vật cản, camera tự động tiến gần nhân vật.
- Khi vật cản biến mất, camera trở lại vị trí ban đầu.
- Camera collision không được thay đổi hướng bắn ngoài ý muốn.
- Cần xử lý các trường hợp đứng sát tường hoặc góc khuất.

---

## 4. Aim Direction & Bullet Trajectory

### 4.1. Nguyên tắc

Camera và nòng súng không luôn nằm cùng một vị trí.

Đặc biệt trong TPP:

- Camera nằm phía sau và lệch vai nhân vật.
- Nòng súng nằm phía trước nhân vật.
- Hướng nhìn camera có thể khác với hướng nòng súng.
- Nếu bắn thẳng theo hướng nòng súng, đạn có thể lệch tâm ngắm.

Do đó, cần tách biệt:

- `CameraDirection`: Hướng nhìn của camera.
- `AimPoint`: Điểm mà người chơi đang ngắm.
- `MuzzlePosition`: Vị trí đầu nòng súng.
- `BulletDirection`: Hướng đạn thực tế.

### 4.2. Xác định Aim Point

Thực hiện Raycast từ tâm camera.

**Quy trình:**

1. Lấy `CameraPosition`.
2. Lấy `CameraForward`.
3. Tạo ray từ camera theo hướng nhìn.
4. Raycast vào môi trường.
5. Nếu trúng vật thể, lấy `HitPoint`.
6. Nếu không trúng, lấy điểm ở khoảng cách ngắm tối đa.
7. Lưu kết quả vào `AimPoint`.

### 4.3. Xác định Bullet Direction

Đạn phải xuất phát từ nòng súng.

**Công thức:**

`BulletDirection = Normalize(AimPoint - MuzzlePosition)`

**Quy trình:**

1. Xác định `AimPoint`.
2. Xác định `MuzzlePosition`.
3. Tính vector từ nòng súng đến `AimPoint`.
4. Chuẩn hóa vector.
5. Áp dụng spread, recoil hoặc ballistic model.
6. Thực hiện raycast hoặc tạo projectile từ nòng súng.

### 4.4. Xử lý vật cản

Cần xử lý trường hợp camera nhìn thấy mục tiêu nhưng nòng súng bị che khuất.

**Ví dụ:**

- Nhân vật đứng sau tường.
- Camera TPP nhìn qua mép tường.
- Crosshair nằm trên đối thủ.
- Tuy nhiên, nòng súng vẫn nằm sau tường.

**Kết quả mong muốn:**

- Đạn phải va vào tường nếu đường bắn thực tế bị cản.
- Không cho đạn xuyên tường chỉ vì camera nhìn thấy mục tiêu.
- Không dùng điểm xuất phát camera để thay thế nòng súng.
- Có thể cảnh báo người chơi khi nòng súng bị cản.

---

## 5. ADS Controller

### 5.1. Input Configuration

Hỗ trợ hai chế độ kích hoạt ADS.

**ADS Hold:**

- Nhấn giữ phím để bắt đầu ADS.
- Thả phím để thoát ADS.

**ADS Toggle:**

- Nhấn một lần để bắt đầu ADS.
- Nhấn lần nữa để thoát ADS.

Các phím điều khiển nên được cấu hình thông qua Input System.

### 5.2. ADS States

| State | Mô tả |
|---|---|
| `HIP` | Không sử dụng ADS |
| `ADS_ENTER` | Đang chuyển sang ADS |
| `ADS_IDLE` | Đang giữ ADS |
| `ADS_EXIT` | Đang thoát ADS |

### 5.3. Enter ADS

Khi người chơi kích hoạt ADS:

1. Kiểm tra vũ khí có hỗ trợ ADS hay không.
2. Kiểm tra trạng thái hiện tại của nhân vật.
3. Chuyển Aim State thành `ADS_ENTER`.
4. Phát animation `Aim_Enter`.
5. Di chuyển camera đến vị trí ADS.
6. Nội suy FOV theo cấu hình scope.
7. Điều chỉnh vị trí vũ khí.
8. Kích hoạt Aim Offset và Weapon IK.
9. Ẩn crosshair thông thường.
10. Chuyển sang `ADS_IDLE` khi hoàn tất.

### 5.4. ADS Idle

Trong trạng thái ADS:

- Camera điều khiển hướng ngắm.
- Aim Offset cập nhật theo hướng nhìn.
- Weapon IK căn chỉnh vị trí tay và súng.
- Cho phép bắn bằng `Fire_ADS`.
- Recoil được áp dụng lên camera và vũ khí.
- Hỗ trợ di chuyển nếu gameplay cho phép.
- Tốc độ di chuyển và spread được điều chỉnh theo loại súng.

### 5.5. Exit ADS

Khi người chơi thoát ADS:

1. Chuyển Aim State thành `ADS_EXIT`.
2. Phát animation `Aim_Exit`.
3. Nội suy FOV về giá trị trước ADS.
4. Đưa camera về FPP hoặc TPP trước đó.
5. Đưa súng về vị trí cầm bình thường.
6. Khôi phục crosshair.
7. Khôi phục các thông số di chuyển.
8. Chuyển Aim State thành `HIP`.

### 5.6. ADS Interruption

Cần xử lý việc ADS bị gián đoạn khi:

- Nhân vật chết.
- Nhân vật bị hạ gục.
- Người chơi đổi vũ khí.
- Nhân vật thực hiện hành động không tương thích.
- Vũ khí bị vô hiệu hóa.
- Người chơi chuyển trạng thái đặc biệt.

Không nên bắt buộc hoàn thành ADS Animation khi gameplay yêu cầu hủy hành động.

---

## 6. Animation System

### 6.1. FPP Animation

Các animation đề xuất:

| Animation | Mô tả |
|---|---|
| `FPP_Idle` | Cầm súng bình thường |
| `FPP_Aim_Enter` | Đưa súng lên ADS |
| `FPP_Aim_Idle` | Giữ tư thế ADS |
| `FPP_Aim_Exit` | Hạ súng khỏi ADS |
| `FPP_Fire_Hip` | Bắn không ADS |
| `FPP_Fire_ADS` | Bắn trong ADS |
| `FPP_Recoil` | Giật súng |
| `FPP_Reload` | Thay đạn |

**Yêu cầu:**

- Sử dụng animation tay và vũ khí có độ chi tiết cao.
- Đầu ruồi hoặc scope phải căn đúng với tâm camera.
- Camera không nên chịu toàn bộ chuyển động rung của head bone.
- Hỗ trợ recoil và weapon sway độc lập.
- Có thể dùng procedural animation để cải thiện chuyển động.

### 6.2. TPP Animation

Các animation đề xuất:

| Animation | Mô tả |
|---|---|
| `TPP_Rifle_Idle` | Đứng cầm súng |
| `TPP_Aim_Enter` | Nâng súng lên ngắm |
| `TPP_Aim_Idle` | Giữ tư thế ngắm |
| `TPP_Aim_Exit` | Hạ súng |
| `TPP_Fire_Hip` | Bắn không ADS |
| `TPP_Fire_ADS` | Bắn khi ADS |
| `TPP_Recoil` | Giật súng |

**Yêu cầu:**

- Sử dụng animation toàn thân.
- Phần thân dưới tiếp tục sử dụng Locomotion.
- Phần thân trên sử dụng Upper Body Animation Layer.
- Aim Offset điều khiển hướng súng.
- Weapon IK giữ tay đúng vị trí.
- Camera hoạt động độc lập với chuyển động animation toàn thân.

### 6.3. Animation Layer Architecture

Hệ thống animation nên chia thành các layer.

**Base Locomotion Layer:**

- Idle.
- Walk.
- Run.
- Sprint.
- Crouch.
- Prone.

**Upper Body Layer:**

- Aim.
- Fire.
- Reload.
- Equip.
- Unequip.

**Additive Layer:**

- Aim Offset.
- Recoil.
- Lean.
- Breathing.
- Weapon Sway.

**IK Layer:**

- Left Hand IK.
- Right Hand IK.
- Weapon IK.
- Foot IK.

### 6.4. Aim Offset

Aim Offset dùng để điều chỉnh hướng súng theo camera.

Các pose đề xuất:

- `Aim_Center`
- `Aim_Up`
- `Aim_Down`
- `Aim_Left`
- `Aim_Right`

**Yêu cầu:**

- Xác định góc chênh lệch giữa hướng nhân vật và hướng camera.
- Sử dụng góc Pitch và Yaw để tính Aim Offset.
- Giới hạn góc xoay theo tư thế.
- Phối trộn pose một cách liên tục.
- Hỗ trợ Standing, Crouching và Prone.

### 6.5. Weapon IK

Weapon IK dùng để điều chỉnh vị trí tay và súng.

**Yêu cầu:**

- Tay phải giữ đúng vị trí tay cầm chính.
- Tay trái đặt đúng vị trí tay cầm phụ.
- Vị trí IK được cấu hình theo từng vũ khí.
- ADS phải căn chỉnh trục ngắm với camera.
- Hỗ trợ thay đổi phụ kiện vũ khí.
- Có thể tạm điều chỉnh IK trong quá trình Reload.

---

## 7. Scope System

### 7.1. Scope Configuration

Mỗi loại scope cần có cấu hình riêng.

| Thuộc tính | Mô tả |
|---|---|
| `scopeType` | Loại scope |
| `magnification` | Độ phóng đại |
| `adsFov` | FOV khi ADS |
| `adsSpeed` | Tốc độ chuyển ADS |
| `sightOffset` | Vị trí căn chỉnh |
| `reticleType` | Loại tâm ngắm |
| `sensitivityMultiplier` | Hệ số độ nhạy |
| `renderMode` | Cách hiển thị scope |

### 7.2. Các loại Scope

Hệ thống có thể hỗ trợ:

- Iron Sight.
- Red Dot.
- Holographic Sight.
- 2x Scope.
- 3x Scope.
- 4x Scope.
- 6x Scope.
- 8x Scope.

### 7.3. Scope Rendering

Có thể sử dụng:

- Thay đổi camera FOV.
- Render Texture cho scope phóng đại.
- Scope Overlay.
- Picture-in-Picture Scope.

Phương pháp được lựa chọn phụ thuộc vào chất lượng đồ họa và hiệu năng mong muốn.

Không nên mặc định rằng thu hẹp FOV luôn mô phỏng chính xác mọi loại scope.

---

## 8. Combat Stance Integration

### 8.1. Standing

- Hỗ trợ Hip Fire.
- Hỗ trợ Shoulder Aim.
- Hỗ trợ ADS.
- Hỗ trợ Lean.
- Hỗ trợ di chuyển khi đang ngắm.

### 8.2. Crouching

- Camera được hạ thấp theo tư thế.
- Hỗ trợ ADS và Hip Fire.
- Hỗ trợ Aim Offset.
- Có thể hỗ trợ Lean.
- Giảm tốc độ di chuyển.

### 8.3. Prone

- Camera được hạ gần mặt đất.
- Hỗ trợ ADS và Hip Fire theo cấu hình gameplay.
- Giới hạn Pitch và Yaw.
- Xử lý va chạm với mặt đất.
- Điều chỉnh Weapon IK phù hợp.
- Tránh để nòng súng xuyên qua địa hình.

### 8.4. Leaning

- Hỗ trợ nghiêng trái và phải.
- Camera dịch chuyển tương ứng.
- Animation nghiêng sử dụng Additive Layer.
- Hướng súng được cập nhật theo camera.
- Kiểm tra vật cản ở vị trí nòng súng.
- Không cho camera xuyên tường.

---

## 9. System Architecture

### 9.1. Player Controller

Quản lý input:

- Fire.
- ADS Hold / Toggle.
- Shoulder Aim.
- Switch FPP / TPP.
- Move.
- Look.
- Crouch.
- Prone.
- Lean.

### 9.2. Aim Controller

Quản lý logic ngắm:

- Aim Mode.
- Aim State.
- Camera Raycast.
- Aim Point.
- Aim Direction.
- Aim Offset.
- ADS Transition.

### 9.3. Camera Controller

Quản lý camera:

- FPP Camera.
- TPP Camera.
- Shoulder Camera.
- ADS Camera.
- Camera Transition.
- Camera Collision.
- FOV.
- Camera Recoil.

### 9.4. Weapon Controller

Quản lý súng:

- Weapon State.
- Muzzle Position.
- Bullet Direction.
- Fire Mode.
- Spread.
- Recoil.
- Magazine.
- Reload.

### 9.5. Animation Controller

Quản lý animation:

- Base Locomotion.
- Upper Body.
- ADS Animation.
- Aim Offset.
- Additive Recoil.
- Weapon IK.
- Animation Transition.

### 9.6. Nguyên tắc kết nối

- Player Controller nhận input từ người chơi.
- Aim Controller xác định chế độ và mục tiêu ngắm.
- Camera Controller quản lý góc nhìn.
- Weapon Controller thực hiện hành động bắn.
- Animation Controller hiển thị chuyển động tương ứng.
- Các controller sử dụng chung trạng thái gameplay cần thiết.

---

## 10. Các trường hợp đặc biệt

### 10.1. Camera nhìn thấy mục tiêu nhưng súng bị che

- Raycast từ camera xác định Aim Point.
- Đạn vẫn phải xuất phát từ Muzzle Position.
- Vật cản trên đường đạn phải được xử lý chính xác.

### 10.2. Camera đứng sát tường

- Camera tự động điều chỉnh khoảng cách.
- Tránh xuyên qua vật cản.
- Không thay đổi hướng ngắm ngoài ý muốn.

### 10.3. Chuyển TPP sang ADS

- Giữ nguyên hướng nhìn.
- Chuyển camera đến trục ngắm.
- Đồng bộ animation nâng súng.
- Không làm crosshair nhảy đột ngột.

### 10.4. Bắn khi đang chuyển ADS

- Gameplay quyết định có cho phép bắn hay không.
- Spread thay đổi theo tiến độ ADS.
- Animation bắn phải phối hợp với animation chuyển ADS.

### 10.5. ADS khi Reload

- Xác định hành động nào có quyền ưu tiên.
- Có thể tự động thoát ADS khi Reload.
- Có thể cho phép Reload giữ một phần tư thế ngắm.
- Hành vi phải nhất quán với Weapon State Machine.

### 10.6. Multiplayer

- Đồng bộ Aim Direction.
- Đồng bộ Weapon State.
- Đồng bộ ADS State.
- Đồng bộ Fire Events.
- Đồng bộ Combat Stance.
- Server xác thực kết quả bắn.
- Tránh phụ thuộc hoàn toàn vào camera và animation phía client.

---

## 11. Lộ trình triển khai

### Phase 1 - Basic Camera

- [ ] FPP Camera.
- [ ] TPP Camera.
- [ ] Switch FPP / TPP.
- [ ] Camera Look Input.
- [ ] Camera Collision.

### Phase 2 - Basic Aiming

- [ ] Camera Raycast.
- [ ] Aim Point.
- [ ] Muzzle Position.
- [ ] Bullet Direction.
- [ ] Hip Fire.
- [ ] Muzzle Obstruction Detection.

### Phase 3 - ADS

- [ ] ADS Hold.
- [ ] ADS Toggle.
- [ ] ADS Camera Transition.
- [ ] ADS FOV.
- [ ] Aim Enter Animation.
- [ ] Aim Idle Animation.
- [ ] Aim Exit Animation.
- [ ] Fire ADS Animation.

### Phase 4 - Advanced Animation

- [ ] Upper Body Animation Layer.
- [ ] Aim Offset.
- [ ] Weapon IK.
- [ ] Additive Recoil.
- [ ] Weapon Sway.
- [ ] Breathing Animation.

### Phase 5 - Tactical Aiming

- [ ] Shoulder Aim.
- [ ] Crouch ADS.
- [ ] Prone ADS.
- [ ] Lean Left.
- [ ] Lean Right.
- [ ] Scope Configuration.

### Phase 6 - Multiplayer

- [ ] Aim Direction Synchronization.
- [ ] Weapon State Synchronization.
- [ ] ADS State Synchronization.
- [ ] Fire Event Synchronization.
- [ ] Server-side Hit Validation.
- [ ] Animation Interpolation.

---

## 12. Nguyên tắc thiết kế

1. Camera quyết định mục tiêu mà người chơi muốn ngắm.
2. Nòng súng quyết định vị trí thực tế viên đạn xuất phát.
3. Aim Point được xác định từ hướng nhìn camera.
4. Bullet Direction được tính từ nòng súng đến Aim Point.
5. Phải kiểm tra va chạm thực tế trên đường đạn.
6. FPP và TPP nên sử dụng chung Aim Controller.
7. Camera Controller xử lý riêng từng góc nhìn.
8. Animation Controller không trực tiếp quyết định kết quả bắn.
9. Aim Offset và Weapon IK giúp hướng súng phù hợp với camera.
10. ADS Transition phải giữ chuyển động liên tục và tự nhiên.
11. Scope Configuration nên độc lập với Weapon Controller.
12. Multiplayer cần xác thực hành động bắn tại server.

## 13. Kết luận

Hệ thống ngắm FPP và TPP nên được thiết kế dưới dạng các module độc lập:

- **Player Controller:** Nhận input.
- **Aim Controller:** Xử lý logic ngắm.
- **Camera Controller:** Điều khiển góc nhìn.
- **Weapon Controller:** Điều khiển súng và đường đạn.
- **Animation Controller:** Điều khiển chuyển động nhân vật.
- **IK System:** Căn chỉnh tay, súng và hướng ngắm.
- **Scope System:** Quản lý đầu ruồi và ống ngắm.

**Nguyên tắc quan trọng nhất:**

Camera xác định nơi người chơi muốn bắn, còn nòng súng quyết định đường đạn
thực tế. Animation và IK đảm bảo hai hệ thống này hoạt động tự nhiên và đồng bộ.

Kiến trúc này cho phép hỗ trợ FPP, TPP, Shoulder Aim và ADS mà không phải
xây dựng lại toàn bộ hệ thống chiến đấu cho từng góc nhìn.