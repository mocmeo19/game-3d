# Đặc tả model 3D nhân vật (Blade & Soul Character Creator)

Tài liệu này dành cho họa sĩ 3D. Mục tiêu: một bộ model nhân vật dạng người, chạy thời gian thực trên **trình duyệt web (Three.js / glTF 2.0)**, có đủ blendshape để mọi thanh trượt chỉnh khuôn mặt và cơ thể trong phần mềm hoạt động thật trên hình học.

> Phiên bản tài liệu: 1.0 · Ngôn ngữ giao diện của phần mềm: tiếng Việt · Ngày soạn: 15/10/2026

---

## 1. Tổng quan sản phẩm

Phần mềm là công cụ tạo nhân vật theo phong cách **Blade & Soul** (nghệ sĩ Hyung-Tae Kim): dáng người thon cao, mắt to, mũi nhỏ, cằm chữ V, da bóng. Người dùng chọn chủng tộc, lớp nhân vật, rồi chỉnh ngoại hình bằng **38 thanh trượt khuôn mặt** và **21 thanh trượt cơ thể**, chọn kiểu tóc, trang phục, màu da, trang điểm, họa tiết mặt, tư thế, vũ khí. Sau khi tạo xong, nhân vật xuất hiện trong màn hình "Hero Archive" (hồ sơ nhân vật) nên model cũng cần đẹp khi đứng tĩnh, ánh sáng nhẹ.

Hiện phần mềm đang dùng một model tạm (avatar Ready Player Me) và một model dựng bằng code. Cả hai đều **không đạt chất lượng** và không có đủ blendshape, vì vậy cần model chính thức theo đặc tả này.

**Tham chiếu phong cách:** ảnh chụp màn hình tạo nhân vật Blade & Soul (sẽ được gửi kèm). Hướng tới tỉ lệ thực tế–cách điệu, **không** phải chibi, **không** phải hiện thực chủ nghĩa như ảnh chụp.

## 2. Phạm vi giao hàng

### Giai đoạn 1 (bắt buộc, kiểm tra khả thi)
1. **Nhân vật nữ Jin** (base mesh nữ) với đầy đủ khung xương, UV, texture da, mắt, răng.
2. **Toàn bộ 38 morph khuôn mặt** và **toàn bộ 21 morph/xương cơ thể** (mục 6).
3. **3 kiểu tóc** và **2 bộ trang phục** làm mẫu để kiểm tra quy trình (mục 7, 8).
4. File `.glb` chạy được trên Three.js (mục 9, 10, 11).

### Giai đoạn 2
5. **Nhân vật nam** (cùng khung xương, cùng tên morph).
6. Đủ **25 kiểu tóc** và **18 bộ trang phục** (mục 7, 8).
7. Tai/đuôi cho chủng tộc **Lyn** (mục 4.3).
8. Texture trang điểm, họa tiết mặt (mục 9).

Có thể chia theo mốc (milestone) và nghiệm thu từng mốc (mục 14).

## 3. Quy ước chung

| Mục | Yêu cầu |
|---|---|
| Định dạng | **glTF 2.0 nhị phân `.glb`** (mỗi nhóm một file, xem mục 11) |
| Đơn vị | 1 đơn vị = **1 mét** |
| Hệ trục | glTF chuẩn: **+Y lên, +Z là hướng nhìn của nhân vật** (mặt hướng về +Z) |
| Bên trái/phải | "Trái" của nhân vật là **+X**, "phải" là **−X** (nhìn từ trước) |
| Tâm gốc | Gốc tọa độ (0,0,0) nằm **ở mặt sàn, dưới giữa hai bàn chân** |
| Chiều cao mặc định | **1,72 m** cho nữ Jin (đỉnh đầu, không tính tóc); nam 1,80 m |
| Tư thế gốc (rest pose) | **A-pose**: tay hạ xuống chếch ra ngoài khoảng 20° so với thân, bàn tay thả lỏng, hai chân song song hơi mở, **không** T-pose |
| Tỉ lệ | Khoảng **8–8,5 đầu**, chân dài (khớp hông cao khoảng 0,87 × chiều cao đứng) |
| Phong cách | Thực tế–cách điệu kiểu Blade & Soul; da mịn, bóng; không lỗ chân lông quá chi tiết |
| Phần mềm dựng | Tùy họa sĩ (Blender, Maya, 3ds Max, ZBrush…), nhưng **bắt buộc xuất được glTF** kèm morph target |

## 4. Cấu trúc và tên mesh

Mỗi thành phần là **mesh riêng, có tên cố định** để phần mềm bật/tắt và đổi vật liệu độc lập.

### 4.1 Cơ thể
| Tên mesh | Nội dung |
|---|---|
| `Body` | Thân, tay, chân, bàn tay, bàn chân. **Không có** quần áo. Có đồ lót hoặc da trần kín (không để lộ hở) |
| `Head` | Đầu và cổ trên (có khớp nối khít với `Body` ở cổ, không hở, không lệch normal) |
| `Eye_L`, `Eye_R` | Nhãn cầu + mống mắt, riêng cho từng mắt |
| `Cornea_L`, `Cornea_R` (tùy chọn) | Lớp giác mạc trong suốt có phản chiếu |
| `Eyelash` | Lông mi (có thể là mesh riêng hoặc card) |
| `Eyebrow` | Lông mày (mesh riêng để đổi màu) |
| `Teeth`, `Tongue` | Răng và lưỡi (nhìn thấy khi mở miệng) |

Các mesh trên **dùng chung một khung xương**. `Head`, `Teeth`, `Tongue`, `Eyebrow`, `Eyelash` phải có **cùng bộ morph khuôn mặt** (cùng tên, cùng số lượng, mỗi mesh biến dạng khớp với `Head`).

### 4.2 Tóc
- **Mỗi kiểu tóc là một mesh riêng**, tên theo mã ở mục 7: `Hair_<mã>`, ví dụ `Hair_ponytail`.
- Mỗi kiểu có thể kèm mesh phụ kiện tách riêng (dây buộc, trâm cài): `HairAcc_<mã>`.
- Tóc gán trọng số vào xương `Head` (và một ít `Neck`/`Spine2` cho tóc dài để lay theo tư thế).
- Tóc **phải khớp với hình học đầu đã biến dạng** bởi morph mặt (xem mục 7.3).

### 4.3 Chủng tộc Lyn (tai và đuôi)
| Tên mesh | Nội dung |
|---|---|
| `Ear_fox`, `Ear_cat`, `Ear_bunny`, `Ear_bear` | Bốn kiểu tai, gắn vào xương `Head` |
| `Tail_fox`, `Tail_cat` | Hai kiểu đuôi, xương riêng `Tail_0 … Tail_5` nối từ `Hips`, để phần mềm cho đuôi vẫy |

Chủng tộc Lyn thấp hơn (~0,76 chiều cao chuẩn), Gon cao hơn (~1,10); **tỉ lệ này do phần mềm scale chung**, họa sĩ chỉ cần làm model chuẩn Jin.

### 4.4 Trang phục
Xem mục 8.

## 5. Khung xương

Dùng **bộ xương humanoid kiểu Mixamo/RPM** (tên không có tiền tố). Mọi xương phải có tên **chính xác** như dưới đây.

```
Hips
├─ Spine → Spine1 → Spine2
│   ├─ Neck → Head → HeadTop_End
│   │          ├─ LeftEye
│   │          └─ RightEye
│   ├─ LeftShoulder → LeftArm → LeftForeArm → LeftHand → (LeftHandThumb1-4, LeftHandIndex1-4,
│   │                                              LeftHandMiddle1-4, LeftHandRing1-4, LeftHandPinky1-4)
│   └─ RightShoulder → RightArm → RightForeArm → RightHand → (…tương tự, tiền tố Right)
├─ LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase → LeftToe_End
└─ RightUpLeg → RightLeg → RightFoot → RightToeBase → RightToe_End
```

- **Số xương tối đa khoảng 70**; chỉ đủ cho người, không thêm xương cơ/phụ (corrective bone) trừ khi thật cần.
- Hướng trục xương: ở **A-pose, trục xương cánh tay/chân chỉ thẳng theo chiều chi** (trục Y của xương hướng về xương con). Phần mềm xoay xương theo hướng nên cần đồng nhất giữa trái–phải (đối xứng gương).
- **Trọng số (skin weights)**: tối đa **4 ảnh hưởng/đỉnh**, tổng bằng 1, đã chuẩn hóa. Không có đỉnh nào mất trọng số.
- Phần mềm sẽ **scale xương** để thể hiện một số thông số (xem cột "Cách thể hiện" ở mục 6.3), nên **khớp vai, hông, đầu gối, khuỷu phải biến dạng hợp lý** khi scale theo trục X/Z (độ dày) và Y (độ dài).

## 6. Danh sách morph (blendshape)

### 6.1 Quy ước đặt tên và trọng số
- Mỗi thanh trượt gồm **hai morph một chiều**: `<khóa>_neg` và `<khóa>_pos`. Giá trị trượt từ −20 đến +20 tương ứng trọng số `0…1`:
  - Giá trị ≥ 0 → `<khóa>_pos` = giá trị/20, `<khóa>_neg` = 0.
  - Giá trị < 0 → `<khóa>_neg` = |giá trị|/20, `<khóa>_pos` = 0.
- Ví dụ: `eyeSize_pos` làm mắt **to hơn** ở mức tối đa, `eyeSize_neg` làm mắt **nhỏ hơn** ở mức tối đa.
- **Mức biến dạng tối đa (trọng số = 1)** phải **nhìn rõ nhưng không vỡ hình** (không xuyên mesh, không méo UV nặng). Ghi rõ ở cột "Mô tả" hướng của `_pos`.
- Các morph **chỉ ảnh hưởng vùng liên quan**, mượt (falloff mềm).
- Các morph cộng dồn tuyến tính, nhiều morph bật cùng lúc vẫn phải ổn.
- Toàn bộ morph khuôn mặt nằm trên `Head`, `Teeth`, `Tongue`, `Eyebrow`, `Eyelash`, `Eye_L/R` (mắt di chuyển theo, hình cầu không méo) với **cùng tên**.

### 6.2 Morph khuôn mặt (38)

| Nhóm | Khóa (`<khóa>_neg/_pos`) | Mô tả hướng `_pos` |
|---|---|---|
| **Khuôn mặt** | `faceWidth` | Mặt rộng hơn ngang |
| | `faceLength` | Mặt dài hơn theo chiều dọc |
| | `foreheadHeight` | Trán cao hơn |
| | `foreheadWidth` | Trán rộng hơn |
| | `cheekbones` | Xương gò má nhô ra và cao hơn |
| | `cheekFullness` | Má đầy hơn |
| **Mắt** | `eyeHeight` | Hai mắt dịch lên cao hơn |
| | `eyeSpacing` | Hai mắt xa nhau hơn |
| | `eyeSize` | Mắt to hơn (cả rộng và cao, nhãn cầu cũng to) |
| | `eyeWidth` | Mắt dài hơn theo chiều ngang |
| | `eyeAngle` | Góc mắt nghiêng, đuôi mắt cao hơn |
| | `eyeOuterCorner` | Đuôi mắt kéo dài và hếch lên |
| | `irisSize` | Mống mắt to hơn (đồng tử đi theo) |
| **Lông mày** | `browHeight` | Lông mày cao hơn |
| | `browSpacing` | Hai lông mày xa nhau hơn |
| | `browAngle` | Đuôi lông mày nâng cao |
| | `browLength` | Lông mày dài hơn |
| | `browThickness` | Lông mày dày hơn |
| **Mũi** | `noseVertical` | Cả mũi dịch lên cao |
| | `noseLength` | Mũi dài hơn (đầu mũi hạ xuống) |
| | `noseHeight` | Sống mũi cao hơn (nhô ra) |
| | `noseBridgeWidth` | Sống mũi rộng hơn |
| | `noseWidth` | Cánh mũi rộng hơn |
| | `noseTipWidth` | Đầu mũi to hơn |
| | `noseProjection` | Đầu mũi nhô ra phía trước |
| **Miệng** | `mouthHeight` | Miệng dịch lên cao |
| | `mouthWidth` | Miệng rộng hơn |
| | `upperLip` | Môi trên dày hơn |
| | `lowerLip` | Môi dưới dày hơn |
| | `lipFullness` | Cả hai môi đầy hơn |
| | `lipSmile` | Khóe miệng nhếch lên (cười), `_neg` là mếu |
| | `mouthProtrusion` | Miệng/môi chu ra phía trước |
| **Cằm và hàm** | `chinLength` | Cằm dài hơn |
| | `jawBackWidth` | Phần hàm sau (gần tai) rộng hơn |
| | `jawWidth` | Hàm rộng hơn |
| | `chinWidth` | Đầu cằm rộng hơn |
| | `chinProtrusion` | Cằm nhô ra phía trước |
| | `chinAngle` | Cằm nhọn/vuông: `_pos` góc cằm sắc hơn |

> **Biểu cảm bổ sung (tùy chọn, ngoài 38 morph):** `mouthOpen`, `eyesClosed`, `eyeLookUp/Down/Left/Right` để làm chớp mắt/nói. Nên có, không bắt buộc.

### 6.3 Thông số cơ thể (21)

Hai cách thể hiện: **Morph** (blendshape trên `Body`) hoặc **Xương** (phần mềm scale xương). Họa sĩ nên làm **morph cho tất cả mục** nếu được; mục đánh dấu "Xương" là mức tối thiểu chấp nhận được, miễn khớp xương có trọng số tốt.

| Nhóm | Khóa | Mô tả hướng `_pos` | Cách thể hiện |
|---|---|---|---|
| **Toàn thân** | `height` | Cao hơn (scale tổng thể, không cần morph) | Xương/Scale |
| | `headSize` | Đầu to hơn (cả `Head` và tóc) | Xương |
| | `neckLength` | Cổ dài hơn | Morph hoặc xương |
| | `neckThickness` | Cổ dày hơn | Morph hoặc xương |
| **Thượng thể** | `shoulderWidth` | Vai rộng hơn | Morph |
| | `shoulderSlope` | Vai xuôi hơn (dốc xuống) | Morph |
| | `chestSize` | Ngực lớn hơn | **Morph** (bắt buộc) |
| | `chestHeight` | Ngực đặt cao hơn | **Morph** |
| | `chestSpacing` | Hai bên ngực xa nhau hơn | **Morph** |
| | `torsoLength` | Thân trên dài hơn (eo cao hơn) | Morph hoặc xương |
| | `waistWidth` | Eo to hơn | Morph |
| | `abdomen` | Bụng nhô ra | Morph |
| **Tay** | `armLength` | Tay dài hơn | Xương |
| | `armThickness` | Tay to hơn | Morph |
| | `handSize` | Bàn tay lớn hơn | Xương |
| **Hạ thể** | `pelvisWidth` | Hông rộng hơn | Morph |
| | `glutes` | Mông đầy hơn | Morph |
| | `legLength` | Chân dài hơn | Xương |
| | `thighThickness` | Đùi to hơn | Morph |
| | `calfThickness` | Bắp chân to hơn | Morph |
| | `footSize` | Bàn chân lớn hơn | Xương |

Quy tắc đặt tên morph cơ thể giống mục 6.1 (`chestSize_neg`, `chestSize_pos`, …). Mọi morph cơ thể phải được **áp dụng đồng bộ lên trang phục** (xem mục 8.3).

### 6.4 Giới hạn và mặc định
- **Mặc định mọi morph = 0** (hình gốc là hình chuẩn đã đẹp, không phải hình trung tính vô hồn).
- Dải trượt trong phần mềm là **−20 … +20 bước nguyên**. Giá trị tối đa tương ứng biến dạng mạnh nhưng còn dùng được.
- Hai chiều không nhất thiết đối xứng về độ lớn (ví dụ `chestSize_pos` được phép mạnh hơn `_neg`).

## 7. Tóc

### 7.1 Danh sách kiểu tóc (25)

| Mã | Tên hiển thị | Mô tả ngắn |
|---|---|---|
| `ponytail` | Đuôi ngựa cao Hồng Môn | Buộc cao sau đầu, rủ xuống lưng |
| `twintails` | Hai đuôi tóc bay | Hai đuôi dài buông trước ngực |
| `empress` | Búi tóc hoàng hậu | Búi cao sau đỉnh, trâm cài, vài lọn mai |
| `spiky` | Tóc gai võ sĩ | Gai ngắn dựng lên |
| `bob` | Bob lệch mượt | Ngang cằm, vuốt mượt |
| `cascading` | Sóng mềm xõa dài | Dài, gợn sóng mềm |
| `wolf_cut` | Wolf cut bóng đêm | Tầng lớp, dày |
| `topknot` | Búi samurai lãng khách | Búi ngọn đỉnh đầu |
| `ponytail_low` | Đuôi ngựa thấp | |
| `ponytail_side` | Đuôi ngựa lệch | |
| `twintails_short` | Hai chùm ngắn | |
| `twintails_low` | Hai đuôi thấp | |
| `bun_high` | Búi cao | |
| `bun_low` | Búi thấp sau gáy | |
| `braid` | Tết bên | Một bím tết vắt trước vai |
| `half_up` | Nửa buộc gợn sóng | |
| `long_straight` | Dài thẳng | |
| `long_layered` | Dài xếp tầng | |
| `medium_wave` | Sóng vừa | |
| `messy_long` | Dài rối xếp tầng | Kiểu như hình tham chiếu: nhiều lớp, mái dài che mặt |
| `pixie` | Pixie ngắn | |
| `bob_short` | Bob ngang cằm | |
| `bob_long` | Bob dài | |
| `shag_long` | Shag dài | |
| `swept` | Dài vuốt lệch | Mái lệch một bên |

Mỗi kiểu cần **mái (bangs)** phù hợp, và tóc có **chiều dài thực** (các kiểu dài không xuyên vai/ngực trong A-pose).

### 7.2 Yêu cầu kỹ thuật tóc
- **Hair card hoặc mesh khối** tùy ngân sách, tối đa **12.000 tam giác/kiểu** (kiểu rất dài tối đa 18.000).
- **Texture tóc có chuyển màu gốc → ngọn (ombre):** cung cấp **một kênh/UV để phần mềm phối hai màu** (màu gốc, màu ngọn), ví dụ UV chiều V = 0 ở gốc, 1 ở ngọn, hoặc vertex color đỏ = vị trí dọc theo lọn. Ghi rõ cách dùng.
- Vật liệu tóc: có bản đồ alpha (cắt) hoặc alpha-hash; hỗ trợ **độ bóng điều chỉnh được** (roughness) và highlight dạng dải.
- Tóc có **xương phụ nếu cần** để lay (tùy chọn); nếu không, gán trọng số vào `Head`, `Neck`.

### 7.3 Tóc phải khớp với khuôn mặt biến dạng
Khuôn mặt thay đổi theo morph (`faceWidth`, `faceLength`, `foreheadHeight`, `foreheadWidth`, `cheekbones`, `cheekFullness`, `headSize`…). Có hai cách chấp nhận được, họa sĩ **chọn một và ghi rõ**:
1. **Tóc có cùng morph** của vùng sọ (`faceWidth_*`, `faceLength_*`, `foreheadHeight_*`, `foreheadWidth_*`) để ôm khít da đầu.
2. Tóc có **độ dày đủ** (khoảng cách 5–8 mm với da đầu) nên không lộ da khi sọ thay đổi trong ±20.

## 8. Trang phục

### 8.1 Danh sách (18 bộ)

| Mã | Tên hiển thị | Đặc điểm |
|---|---|---|
| `hongmoon` | Đồng phục Hồng Môn | Áo choàng xanh–vàng, tay dài, quần ống rộng, đai, cổ đứng, ủng |
| `blackram` | Hải tặc Blackram | Áo khoác tối, quần ôm, đai, cổ cao, giáp vai, ủng |
| `red_lotus` | Cám dỗ (Hồng Liên) | Đầm dạ hội lụa đỏ, tay ngắn, xòe dài tới bắp chân |
| `pure_white` | Hanbok trắng thiên giới | Áo jeogori tay dài + váy xòe dài chạm sàn |
| `shadow_ninja` | Sát thủ Dạ Nguyệt | Bodysuit ôm, giáp vai, ủng, đai |
| `sculpt_bodysuit` | Đồ lót Hồng Môn | Bodysuit tối giản không tay, quần ngắn |
| `wuxia_robe` | Áo choàng kiếm khách | |
| `qipao` | Sườn xám lụa | |
| `academy` | Đồng phục học viện | |
| `battle_armor` | Giáp tiên phong sắt | |
| `dancer` | Vũ công dưới trăng | |
| `martial_vest` | Áo ghi lê luyện võ | |
| `rogue_leather` | Đồ da bóng đêm | |
| `noble_hanbok` | Hanbok cung đình | |
| `summer_dress` | Váy hè anh đào | |
| `casual` | Bộ hoodie thường ngày | |
| `monk_robe` | Áo tăng ni | |
| `gunslinger_coat` | Áo khoác xạ thủ | |

### 8.2 Cấu trúc mesh
Mỗi bộ gồm các mesh con có tên cố định, để phần mềm đổi màu từng phần:

- `Outfit_<mã>_Top`, `Outfit_<mã>_Bottom`, `Outfit_<mã>_Footwear`, `Outfit_<mã>_Accessory` (đai, giáp vai, cổ áo…)
- Mỗi mesh dùng **hai vùng màu** có thể tùy chỉnh: **màu chính** và **màu phụ (viền, họa tiết)**. Cung cấp **mặt nạ màu** (ví dụ kênh R/G của một texture mask) để phần mềm nhuộm lại, vẫn giữ nếp vải, đường may, họa tiết.
- Vải có normal map và bản đồ độ nhám; kim loại có metallic.

### 8.3 Khớp với cơ thể biến dạng (rất quan trọng)
Người dùng thay đổi cơ thể bằng 21 thông số, nên trang phục phải **thay đổi theo**. Họa sĩ chọn một trong hai cách (nên ghi rõ trong bàn giao):

- **A. Trang phục có cùng morph cơ thể** (`chestSize_*`, `waistWidth_*`, `pelvisWidth_*`, `glutes_*`, `thighThickness_*`, `calfThickness_*`, `shoulderWidth_*`, `armThickness_*`, `abdomen_*`, `torsoLength_*`, `chestHeight_*`, `chestSpacing_*`, `shoulderSlope_*`, `neckThickness_*`…), **cùng tên** như trên `Body`. Đây là cách ưu tiên, đảm bảo không xuyên da.
- **B. Trang phục gán trọng số theo cùng xương**, và phần mềm tự **ẩn phần thân bị che** bằng mặt nạ ẩn (body mask) đi kèm từng bộ: cung cấp **texture mask hoặc nhóm đỉnh** nói rõ vùng nào của `Body` bị quần áo che.

Trang phục phải **không xuyên da** ở các mức: ngực ±20, eo ±20, hông ±20, đùi ±20 ở chủng tộc chuẩn.

### 8.4 Yêu cầu kỹ thuật trang phục
- Tối đa **15.000 tam giác/bộ** (không tính tóc); phần gấu váy dài có thể có xương phụ (tùy chọn).
- Váy dài/áo choàng: nên có **xương phụ** (ví dụ `Skirt_*`) để phần mềm làm váy lay nhẹ theo tư thế; nếu không có, trọng số vào `Hips`/`UpLeg` đủ chấp nhận khi chân giang.
- Giày/ủng thay thế được riêng, không phụ thuộc phần còn lại.

## 9. Vật liệu và texture

| Thành phần | Yêu cầu |
|---|---|
| Hệ vật liệu | **glTF PBR metallic-roughness**, không dùng extension độc quyền; extension chuẩn (`KHR_materials_clearcoat`, `KHR_materials_sheen`, `KHR_texture_transform`, `KHR_mesh_quantization`, `EXT_meshopt_compression` hoặc Draco) chấp nhận |
| Da | **Texture da trung tính** (xám sáng, gần như "albedo gốc") để phần mềm nhuộm theo tông da người dùng chọn; kèm **SSS giả** bằng texture hoặc màu đỏ nhạt ở vành tai, lỗ mũi, môi |
| Độ bóng da | Roughness thấp (khoảng 0,25–0,5), phần mềm điều chỉnh nhẹ; có clearcoat nhẹ để tạo vệt bóng đặc trưng B&S |
| Mống mắt | Texture mống mắt **tách riêng**, phần mềm có thể thay bằng texture khác (màu, kiểu đồng tử tròn / mèo / hoa / rồng). Có độ lõm và vệt sáng giả |
| Kích thước texture | `Body` 2048², `Head` 2048², `Eye` 512², tóc 1024², mỗi trang phục 1024²–2048² (tổng bộ nhớ GPU của một nhân vật hoàn chỉnh **≤ 80 MB**) |
| Định dạng | PNG hoặc KTX2 (Basis) / WebP; sRGB cho albedo, linear cho normal/ORM; normal map **chuẩn glTF (+Y)** |
| UV | Không chồng UV trên `Body` và `Head`; có UV thứ hai nếu dùng lightmap/AO (tùy chọn) |

### Lớp trang điểm và họa tiết mặt
Phần mềm vẽ trang điểm và họa tiết mặt lên da bằng **texture mặt nạ**. Cung cấp UV đầu theo bố cục thống nhất và **mặt nạ vùng** (grayscale, cùng UV `Head`) cho:
- `mask_blush` (má hồng), `mask_eyeshadow_L/R` (phấn mắt), `mask_lips` (môi), `mask_brow_zone` (vùng lông mày), `mask_forehead_mark` (họa tiết trán), `mask_cheek_mark_L/R` (họa tiết má, ví dụ vuốt rồng, ria cáo).

Phần mềm sẽ nhân màu tùy chọn với các mặt nạ này. Họa tiết cụ thể do phần mềm vẽ lên, họa sĩ chỉ cần cung cấp mặt nạ vùng và UV tốt.

## 10. Hiệu năng và giới hạn

| Hạng mục | Mục tiêu |
|---|---|
| Tam giác thân (`Body`) | 18.000–25.000 |
| Tam giác đầu (`Head`) | 10.000–16.000 (mật độ cao quanh mắt, mũi, miệng để morph mượt) |
| Tóc | ≤ 12.000 mỗi kiểu |
| Trang phục | ≤ 15.000 mỗi bộ |
| Tổng một nhân vật hoàn chỉnh | ≤ **90.000 tam giác** |
| Số xương | ≤ 70 (không tính xương phụ tóc/váy/đuôi, tối đa thêm 30) |
| Số morph trên `Head` | Tất cả 76 morph ở mục 6.2 + biểu cảm tùy chọn. Three.js hỗ trợ morph bằng texture nên **không** cần giảm số morph |
| Kích thước file | Mỗi file `.glb` **≤ 8 MB** (nén Draco/meshopt + KTX2 nếu cần); thư viện tải theo yêu cầu (lazy) |

## 11. Quy cách xuất file

### 11.1 Tổ chức file bàn giao
```
/models
  base_female.glb      Body, Head, Eye_L/R, Eyelash, Eyebrow, Teeth, Tongue + khung xương + toàn bộ morph
  base_male.glb        (Giai đoạn 2) cùng khung xương, cùng tên morph
  hair/<mã>.glb        Hair_<mã> (+ HairAcc_<mã>) — dùng cùng khung xương rút gọn (chỉ Head/Neck/Spine2)
  outfit/<mã>.glb      Outfit_<mã>_* — cùng khung xương, cùng morph cơ thể (nếu cách A)
  lyn/ear_*.glb, lyn/tail_*.glb
  textures/            file nguồn (PSD/SBSAR/Substance) + bản xuất
  source/              file dựng gốc (.blend/.ma/.max/.ztl)
```
- Mỗi `.glb` **tự đủ** (nhúng texture hoặc trỏ tới thư mục `textures/`, ghi rõ).
- **Skin** (khung xương) của file tóc và trang phục phải **trùng tên và thứ tự xương** với `base_*.glb` để phần mềm ghép được.

### 11.2 Kiểm tra trước khi bàn giao (checklist)
- [ ] Mở được bằng **three.js GLTFLoader** và trình xem glTF (ví dụ gltf-viewer, Babylon Sandbox) không cảnh báo nghiêm trọng.
- [ ] Tên mesh, xương, morph **trùng khớp** bảng trong tài liệu (phân biệt hoa thường).
- [ ] Mọi morph trọng số từ 0 đến 1 không gây xuyên mesh, không tạo lỗ hở ở cổ, mắt, miệng.
- [ ] Hai giá trị `_neg` và `_pos` bật cùng lúc đều ổn (hoặc ghi chú rõ là loại trừ).
- [ ] A-pose đối xứng, vai/hông/đầu gối uốn cong tốt khi xoay xương ±60°.
- [ ] Không có normal bị lật, không có đỉnh trùng tạo vệt shading ở các đường nối.
- [ ] Texture da trung tính, nhuộm màu sáng/tối đều không bị phẳng hoặc quá bệt.
- [ ] Mống mắt thay được; lông mi không xuyên mí mắt khi mắt to/nhỏ.
- [ ] Tóc không xuyên da đầu ở mức morph mặt ±20; trang phục không xuyên da ở mức morph cơ thể ±20.

## 12. Tương thích với phần mềm

Cách phần mềm sẽ dùng model (để họa sĩ hiểu vì sao các quy ước trên là bắt buộc):
- Đọc glTF bằng Three.js; **đặt trọng số morph** theo bảng ở mục 6.1; scale một số xương (đầu, tay, bàn tay, chân…) theo thanh trượt.
- **Đổi tóc/trang phục** bằng cách bật mesh `Hair_<mã>` và `Outfit_<mã>_*` rồi ẩn mesh còn lại; tất cả dùng chung khung xương.
- **Nhuộm** màu da, màu tóc (gốc/ngọn), màu trang phục (chính/phụ) bằng cách đổi `baseColorFactor` và các mặt nạ.
- **Tư thế**: phần mềm điều khiển xoay xương bằng code (6 tư thế: đứng nghỉ, chiến đấu, chiến thắng, nhảy, làm duyên, cúi chào) và gắn vũ khí vào `LeftHand`/`RightHand`. Không cần clip animation, nhưng nếu có clip idle ngắn thì tốt.
- **Chủng tộc** Gon, Lyn, Yun dùng **cùng model chuẩn** với tỉ lệ scale khác nhau (Gon 1,10; Lyn 0,76; Yun 1,05). Riêng Lyn gắn tai và đuôi.
- **Giới tính:** nữ và nam là hai base mesh riêng (cùng tên morph) vì tỉ lệ khác nhau; Yun chỉ có nữ.

## 13. Giấy phép, bản quyền, thanh toán

- Model phải là **sản phẩm gốc do họa sĩ tạo** (hoặc từ tài sản có giấy phép rõ ràng cho phép **phân phối lại trong ứng dụng web**). **Nêu rõ** mọi tài sản bên thứ ba (base mesh, brush, texture, scan).
- Chuyển giao **toàn bộ quyền sử dụng thương mại**, quyền sửa đổi và quyền **phân phối dưới dạng file trong ứng dụng web** (file `.glb` được tải về máy người dùng). **Không** dùng tài sản có điều khoản cấm phân phối lại file gốc (ví dụ nhiều gói Daz, một số marketplace).
- **Không** sao chép tác phẩm, nhân vật, mô hình hoặc nội dung có bản quyền của game Blade & Soul hay bất kỳ game nào; tham chiếu chỉ về **phong cách**, không sao chép tài nguyên.
- Bàn giao **file nguồn** để bên mình có thể chỉnh sửa về sau.
- Thanh toán theo mốc (đề xuất): 30% khi chốt concept và thử nghiệm morph khuôn mặt, 40% khi bàn giao Giai đoạn 1 đạt nghiệm thu, 30% khi bàn giao Giai đoạn 2.

## 14. Quy trình nghiệm thu đề xuất

1. **Mốc 0 – Thử nghiệm kỹ thuật (nên làm trước):** gửi **một file `.glb` của đầu nữ** chỉ gồm `Head`, mắt, 12 morph chính (`faceWidth`, `eyeSize`, `eyeHeight`, `eyeAngle`, `noseHeight`, `noseWidth`, `mouthWidth`, `lipFullness`, `lipSmile`, `jawWidth`, `chinLength`, `chinProtrusion`) để bên mình thử nạp vào phần mềm và xác nhận quy ước.
2. **Mốc 1 – Giai đoạn 1** (mục 2).
3. **Mốc 2 – Giai đoạn 2** (mục 2).

Mỗi mốc bên mình kiểm tra theo checklist ở mục 11.2 và phản hồi trong **5 ngày làm việc**; cho phép **2 lần chỉnh sửa** miễn phí mỗi mốc.

## 15. Thông tin họa sĩ cần trả lời khi báo giá

1. Phần mềm sẽ dùng và có xuất được **morph target sang glTF** không (đã từng làm chưa).
2. Có thể làm **mọi morph theo cặp `_neg`/`_pos`** và gán **cùng morph lên tóc/trang phục** không (mục 7.3, 8.3).
3. Thời gian và **báo giá riêng** cho: (a) Giai đoạn 1, (b) nhân vật nam, (c) mỗi kiểu tóc thêm, (d) mỗi bộ trang phục thêm, (e) Lyn (tai/đuôi).
4. Có thể cung cấp **sản phẩm mẫu (portfolio)** gồm nhân vật có blendshape khuôn mặt và chạy trên web.
5. Chấp nhận **điều khoản bản quyền** ở mục 13 không.

---

### Phụ lục A: Giá trị số tham chiếu (từ code hiện tại)

Giá trị mặc định (nữ Jin, chưa chỉnh), dùng làm điểm tham chiếu kích thước:

| Số đo | Giá trị |
|---|---|
| Chiều cao đỉnh đầu | 1,72 m |
| Khớp hông cao | ≈ 0,87 m |
| Cao đầu (từ cằm tới đỉnh) | ≈ 0,20–0,21 m |
| Rộng mặt (hai bên sọ) | ≈ 0,15 m |
| Rộng vai (hai khớp vai) | ≈ 0,32 m |
| Chiều dài tay (vai → đầu ngón) | ≈ 0,71 m |
| Khoảng cách hai mắt (tâm–tâm) | ≈ 0,069 m |
| Bán kính nhãn cầu | ≈ 0,0125 m (mắt to kiểu cách điệu) |
| Chiều dài bàn chân | ≈ 0,24 m |

Các tỉ lệ cuối cùng do họa sĩ quyết định theo phong cách tham chiếu, miễn tuân theo **quy ước trục, tên mesh/xương/morph và đơn vị** ở trên.

### Phụ lục B: Danh sách đầy đủ 38 + 21 khóa morph (chép sẵn để đặt tên)

**Mặt (38):**
`faceWidth faceLength foreheadHeight foreheadWidth cheekbones cheekFullness eyeHeight eyeSpacing eyeSize eyeWidth eyeAngle eyeOuterCorner irisSize browHeight browSpacing browAngle browLength browThickness noseVertical noseLength noseHeight noseBridgeWidth noseWidth noseTipWidth noseProjection mouthHeight mouthWidth upperLip lowerLip lipFullness lipSmile mouthProtrusion chinLength jawBackWidth jawWidth chinWidth chinProtrusion chinAngle`

**Cơ thể (21):**
`height headSize neckLength neckThickness shoulderWidth shoulderSlope chestSize chestHeight chestSpacing torsoLength waistWidth abdomen armLength armThickness handSize pelvisWidth glutes legLength thighThickness calfThickness footSize`

Mỗi khóa tạo hai morph: `<khóa>_neg` và `<khóa>_pos` (ví dụ `eyeSize_neg`, `eyeSize_pos`).
