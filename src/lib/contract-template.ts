// Dựng HTML hợp đồng thử việc từ dữ liệu nhân viên + công ty.
// HTML này được Puppeteer render thành PDF.
// Nội dung khung cứng theo bản gốc "HỢP ĐỒNG THỬ VIỆC -DONE".
// Các trường cá nhân hóa được điền vào; trường thiếu để trống có gạch chân.

import type { Employee, Company } from "./types";

/** Escape HTML để tránh vỡ layout khi dữ liệu chứa ký tự đặc biệt. */
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Ô điền: có giá trị thì in đậm, không có thì để đường kẻ trống. */
function fill(value: string, minWidth = 120): string {
  const v = (value || "").trim();
  if (v) return `<span class="filled">${esc(v)}</span>`;
  return `<span class="blank" style="min-width:${minWidth}px"></span>`;
}

interface TemplateInput {
  employee: Employee;
  company: Company;
  chuKyDataUri: string | null; // ảnh chữ ký NLĐ
  conDauDataUri: string | null; // ảnh chữ ký/dấu người đại diện
}

export function renderContractHtml({
  employee: e,
  company: c,
  chuKyDataUri,
  conDauDataUri,
}: TemplateInput): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<style>
  /* Canh để nội dung trải đều đúng 4 trang, dễ đọc như bản gốc. */
  @page { size: A4; margin: 18mm 20mm; }
  * { box-sizing: border-box; }
  body {
    /* "Times New Roman" nếu có (Windows); ngược lại DejaVu Serif / Noto Serif
       — cả hai hỗ trợ đầy đủ tiếng Việt, đảm bảo dấu hiển thị đúng trên server. */
    font-family: "Times New Roman", "DejaVu Serif", "Noto Serif", Times, serif;
    font-size: 13pt;
    line-height: 1.5;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .italic { font-style: italic; }
  .bold-italic { font-weight: bold; font-style: italic; }
  .uppercase { text-transform: uppercase; }
  h1.title { font-size: 15pt; margin: 5pt 0 1pt; }
  .header-nation { font-size: 13pt; font-weight: bold; }
  .header-motto { font-weight: bold; }
  .divider { margin: 2pt 0 10pt; }
  p { margin: 4pt 0; text-align: justify; }
  /* Tiêu đề mục (CĂN CỨ PHÁP LÝ, các Điều) — nghiêng đậm như bản gốc. */
  .section-title { font-weight: bold; font-style: italic; margin-top: 10pt; }
  .filled { font-weight: bold; }
  .blank {
    display: inline-block;
    border-bottom: 1px dotted #000;
    min-width: 120px;
    vertical-align: bottom;
  }
  /* Phần căn cứ pháp lý: chữ nghiêng, không bullet — theo bản gốc. */
  .legal { margin: 2pt 0; font-style: italic; }
  .legal p { margin: 1pt 0; }
  table.sign { width: 100%; margin-top: 20pt; border-collapse: collapse; page-break-inside: avoid; }
  table.sign td { width: 50%; text-align: center; vertical-align: top; padding: 0 8pt; }
  .sign-role { font-weight: bold; }
  .sign-note { font-style: italic; font-size: 11pt; }
  .sign-img { height: 140px; margin: 6pt auto; display: block; }
  /* Ảnh chữ ký + con dấu bên Người sử dụng lao động — to hơn (140→182→218px). */
  .sign-img-employer { height: 218px; margin: 6pt auto; display: block; }
  .sign-space { height: 140px; }
  .indent { padding-left: 10pt; }
</style>
</head>
<body>
  <div class="center header-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
  <div class="center header-motto">Độc lập – Tự do – Hạnh phúc</div>
  <div class="center divider">-----o0o-----</div>

  <h1 class="center title">HỢP ĐỒNG THỬ VIỆC</h1>
  <p class="center">Số: ${fill(e.soHopDong, 80)}</p>

  <p class="section-title">CĂN CỨ PHÁP LÝ</p>
  <div class="legal">
    <p>Bộ luật Lao động 2019;</p>
    <p>Nghị định 145/2020/NĐ-CP quy định chi tiết và hướng dẫn thi hành một số điều của Bộ luật Lao động về điều kiện lao động và quan hệ lao động;</p>
    <p>Nghị định 12/2022/NĐ-CP quy định xử phạt vi phạm hành chính trong lĩnh vực lao động;</p>
    <p>Luật Bảo hiểm xã hội 2014;</p>
    <p>Luật Việc làm 2013 (liên quan bảo hiểm thất nghiệp);</p>
    <p>Luật An toàn, vệ sinh lao động 2015;</p>
    <p>Bộ luật Dân sự 2015 (đối với các vấn đề bồi thường thiệt hại, nghĩa vụ dân sự);</p>
    <p>Luật Bảo vệ quyền lợi người tiêu dùng 2023 (trong trường hợp liên quan khách hàng);</p>
    <p>Các văn bản pháp luật liên quan khác và các quy định nội bộ hợp pháp của Công ty (Nội quy lao động, Quy chế lương thưởng, KPI, Quy chế bảo mật…).</p>
  </div>

  <p class="italic">Hôm nay, ${fill(e.ngayThuViec, 160)} tại ${fill(e.noiKiHD, 160)}.</p>
  <p class="italic">Chúng tôi gồm có:</p>

  <p class="bold" style="margin-top:6pt">BÊN A ( Người sử dụng lao động ): ${fill(c.tenCongTy, 220)}</p>
  <p class="indent">Mã số thuế: ${fill(c.maSoThue, 140)}</p>
  <p class="indent">Địa chỉ: ${fill(c.diaChiTruSo, 300)}</p>
  <p class="indent">Người đại diện: ${fill(c.nguoiDaiDien, 200)}</p>
  <p class="indent">Chức vụ: ${fill(c.chucVu, 140)}</p>
  <p class="indent">Số điện thoại: ${fill(c.soDienThoai, 140)}</p>

  <p class="italic">Và</p>

  <p class="bold" style="margin-top:6pt">BÊN B ( Người Lao Động ):</p>
  <p class="indent">Ông/Bà: ${fill(e.hoTen, 220)}</p>
  <p class="indent">Sinh năm: ${fill(e.ngaySinh, 140)}</p>
  <p class="indent">Điện thoại: ${fill(e.soDienThoai, 140)}</p>
  <p class="indent">Email: ${fill("", 200)}</p>
  <p class="indent">Số căn cước công dân: ${fill(e.cccd, 160)} &nbsp; Cấp ngày: ${fill(e.ngayCap, 120)}</p>
  <p class="indent"><span class="italic">Tại:</span> ${fill(e.noiCap, 220)}</p>
  <p class="indent">Địa chỉ thường trú: ${fill(e.diaChiThuongTru, 300)}</p>
  <p class="indent">Địa chỉ hiện tại cư trú: ${fill(e.diaChiHienTai, 300)}</p>

  <p>Thỏa thuận ký kết Hợp đồng thử việc và cam kết làm đúng những điều khoản sau đây:</p>

  <p class="section-title">Điều 1: Thời hạn, công việc, địa điểm công việc</p>
  <p>- Thời hạn Ông/Bà: ${fill(e.hoTen, 200)} làm việc theo hợp đồng thử việc xác thời hạn 25 ngày, kể từ ngày ${fill(e.ngayThuViec, 160)}.</p>
  <p>- Địa điểm làm việc tại: ${fill(e.coSoLamViec, 300)}</p>
  <p>Địa điểm làm việc sẽ thay đổi khi Công ty có sự thay đổi về địa điểm đặt trụ sở chính, chi nhánh, văn phòng làm việc.</p>
  <p>- Chức vụ: Nhân viên</p>
  <p>- Công việc phải làm: Hoàn thành tốt công việc được đảm nhận, nhiệm vụ được giao, và các công việc khác theo sự phân công của Người sử dụng lao động. Chịu quản lý, điều hành của các cấp quản lý theo Quy chế, Quy định của Công ty.</p>

  <p class="section-title">Điều 2. Chế độ làm việc.</p>
  <p>Thời gian làm việc: 8 tiếng/ngày. 48 tiếng/tuần</p>
  <p>- Điều kiện an toàn và vệ sinh lao động tại nơi làm việc theo quy định hiện hành của nhà nước, của Công ty.</p>

  <p class="section-title">Điều 3. Nghĩa vụ và các quyền lợi người lao động.</p>
  <p class="bold-italic">3.1. Nghĩa vụ:</p>
  <p>- Hoàn thành những công việc đã cam kết trong Hợp đồng thử việc, theo yêu cầu của Công ty.</p>
  <p>- Chấp hành sự điều động, thuyên chuyển theo yêu cầu công việc của Người sử dụng lao động;</p>
  <p>- Trích nộp những khoản thuế thu nhập cá nhân, phí (nếu có) theo quy định của Nhà nước;</p>
  <p>- Chấp hành nghiêm túc kỷ luật lao động, vệ sinh lao động và nội quy của Công ty.</p>
  <p>- Trong công việc, người lao động (B) chịu sự điều hành trực tiếp của người sử dụng lao động.</p>
  <p>- Bồi thường thiệt hại theo các quy định trong nội quy lao động, quy chế của Công ty và pháp luật về lao động.</p>
  <p>- Tuân thủ các quy định do Công ty ban hành.</p>
  <p>- Người lao động đồng ý để người sử dụng lao động huy động làm thêm giờ nếu có phát sinh cần thiết.</p>
  <p class="bold-italic">3.2. Quyền lợi</p>
  <p>- Mức lương thử việc là: 6.000.000 VNĐ/tháng (Bằng chữ: Sáu triệu Việt Nam đồng chẵn) và được trả 01 lần vào ngày 10 hàng tháng. Trường hợp ngày trả lương trùng với ngày nghỉ lễ, Tết hoặc ngày nghỉ hàng tuần, tiền lương sẽ được chi trả vào ngày làm việc liền kề trước hoặc sau kỳ nghỉ, nhưng không chậm quá ngày 10 kể từ ngày đến hạn trả lương, hoặc có sự trao đổi giữa hai Bên theo từng kỳ tiếp theo.</p>
  <p>- Hình thức trả: + Tiền mặt. &nbsp; + Chuyển khoản.</p>
  <p>- Phương tiện đi lại làm việc: Cá nhân tự túc</p>
  <p>- Phụ cấp gồm: Các khoản phụ cấp có thể có do vị trí công tác và quy chế của Công ty.</p>
  <p>- Được cấp đồng phục, đồ dùng phục vụ trong công việc (nếu có)</p>
  <p>- BHXH và BHYT: Công ty và người lao động chịu trách nhiệm đóng BHXH, BHYT và BHTN theo quy định hiện hành của nhà nước sau khi chính thức. Thuế thu nhập cá nhân phát sinh (nếu có) sẽ do người lao động thanh toán.</p>

  <p class="section-title">Điều 4. Nghĩa vụ và quyền hạn của người sử dụng lao động.</p>
  <p class="bold-italic">4.1. Nghĩa vụ:</p>
  <p>- Người sử dụng lao động đảm bảo việc làm cho người lao động theo cam kết trong hợp đồng.</p>
  <p>- Thanh toán đầy đủ các chế độ và quyền lợi cho người lao động đã cam kết trong Hợp đồng thử việc, theo thoả ước lao động tập thể (nếu có).</p>
  <p class="bold-italic">4.2. Quyền hạn:</p>
  <p>Điều hành người lao động hoàn thành công việc được đảm nhận phụ trách.</p>
  <p>Người sử dụng lao động có quyền bố trí, điều chuyển tạm thời, tạm ngừng việc, thay đổi, tạm hoãn, chấm dứt Hợp đồng thử việc với người lao động và áp dụng các biện pháp kỷ luật theo quy định của Công ty cũng như của pháp luật lao động hiện hành.</p>

  <p class="section-title">Điều 5. Điều khoản chung.</p>
  <p class="bold-italic">5.1. Những thỏa thuận khác (nếu có).</p>
  <p>5.1.1 Trong trường hợp người lao động tự ý đơn phương chấm dứt Hợp đồng thử việc trước thời hạn phải báo với người sử dụng lao động bằng văn bản trước 3 ngày làm việc và người lao động phải có trách nhiệm:</p>
  <p>- Hoàn trả lại các trang thiết bị, công cụ dụng cụ... của công ty giao cho sử dụng.</p>
  <p>- Thanh toán đầy đủ các khoản nợ của Công ty (nếu có).</p>
  <p>- Thực hiện các điều khoản theo bản cam kết giữa người lao động và người sử dụng lao động đính kèm.</p>
  <p>5.1.2 Trường hợp Công ty chấm dứt Hợp đồng thử việc trước thời hạn đối với người lao động do người lao động không hoàn thành nhiệm vụ được giao hoặc thái độ làm việc không nghiêm túc hoặc người lao động bị kỷ luật theo hình thức sa thải (quy định trong Điều 85 của Bộ luật lao động) thì người lao động cũng phải có trách nhiệm như đã nêu trong Điều 5 khoản 1.1</p>
  <p>5.1.3 Trong trường hợp Công ty cho người lao động nghỉ việc do thay đổi kế hoạch kinh doanh hoặc người lao động sức khỏe yếu không làm việc được (có xác nhận của cơ quan y tế có thẩm quyền) thì người lao động có thể được miễn bồi hoàn các chi phí đào tạo.</p>
  <p class="bold">Nghĩa vụ bảo mật thông tin.</p>
  <p>Cam kết bảo mật thông tin khách hàng, quy trình làm việc, thông tin tài chính, bí mật kinh doanh, thông tin nội bộ trong và sau quá trình làm việc tại công ty. Có trách nhiệm bồi thường thiệt hại, tổn thất do người sử dụng lao động đưa ra do làm lộ các bí mật kinh doanh, quy trình làm việc, thông tin tài chính, thông tin khách hàng, thông tin nội bộ của công ty.</p>
  <p class="bold">5.3 Điều khoản thi hành.</p>
  <p>Người lao động và người sử dụng lao động đã đọc kỹ và hiểu rõ nội dung trong bản Hợp đồng thử việc, cùng nhau cam kết thực hiện nghiêm chỉnh các điều khoản của hợp đồng này.</p>
  <p>Hợp đồng thử việc này được lập thành 02 (hai) bản, mỗi bản gồm 04 (bốn) trang có giá trị pháp lý như nhau, người sử dụng lao động giữ 01 (một) bản và người lao động giữ 01 (một) bản và có hiệu lực kể từ ngày ký.</p>

  <table class="sign">
    <tr>
      <td>
        <div class="sign-role">NGƯỜI LAO ĐỘNG</div>
        <div class="sign-note">(Ký và ghi rõ họ tên)</div>
        ${
          chuKyDataUri
            ? `<img class="sign-img" src="${chuKyDataUri}" alt="chữ ký" />`
            : `<div class="sign-space"></div>`
        }
      </td>
      <td>
        <div class="sign-role">NGƯỜI SỬ DỤNG LAO ĐỘNG</div>
        <div class="sign-note">(Người đại diện theo pháp luật)</div>
        ${
          conDauDataUri
            ? `<img class="sign-img-employer" src="${conDauDataUri}" alt="chữ ký & dấu" />`
            : `<div class="sign-space"></div>`
        }
      </td>
    </tr>
  </table>
</body>
</html>`;
}
