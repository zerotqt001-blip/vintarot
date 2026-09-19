export type BilingualText = { en: string; vi: string };

export type LegalSection = {
  id: string;
  title: BilingualText;
  paragraphs?: BilingualText[];
  bullets?: BilingualText[];
};

export type LegalDocument = {
  path: "/privacy" | "/terms";
  title: BilingualText;
  summary: BilingualText;
  sections: LegalSection[];
};

export const legalUpdatedAt = "2026-09-19";
export const supportEmail = "zerotqt001@gmail.com";

export const legalDocuments: { privacy: LegalDocument; terms: LegalDocument } = {
  privacy: {
    path: "/privacy",
    title: { en: "Privacy Policy", vi: "Chính sách riêng tư" },
    summary: {
      en: "How NaTarot handles account information, Google sign-in data and your private reflection content.",
      vi: "Cách NaTarot xử lý thông tin tài khoản, dữ liệu đăng nhập Google và nội dung chiêm nghiệm riêng tư của bạn.",
    },
    sections: [
      {
        id: "scope",
        title: { en: "About this policy", vi: "Về chính sách này" },
        paragraphs: [
          {
            en: "This policy applies to the NaTarot website at natarot.com and explains what information we collect, why we use it and the choices available to you. NaTarot is a reflective Tarot experience; its readings are not medical, legal, financial or other professional advice.",
            vi: "Chính sách này áp dụng cho website NaTarot tại natarot.com và giải thích thông tin chúng tôi thu thập, lý do sử dụng và lựa chọn của bạn. NaTarot là trải nghiệm chiêm nghiệm Tarot; nội dung trải bài không phải là tư vấn y tế, pháp lý, tài chính hay tư vấn chuyên môn khác.",
          },
        ],
      },
      {
        id: "data",
        title: { en: "Information we collect", vi: "Thông tin chúng tôi thu thập" },
        paragraphs: [
          {
            en: "When you create a member account, we collect your email address, username, phone number and any display name you choose to save. Your phone number is used for customer care and is not shown publicly by default.",
            vi: "Khi bạn tạo tài khoản thành viên, chúng tôi thu thập email, username, số điện thoại và tên hiển thị mà bạn chọn lưu. Số điện thoại được dùng để chăm sóc khách hàng và mặc định không hiển thị công khai.",
          },
          {
            en: "If you choose Google sign-in, Google provides the basic identity information needed to sign you in: your Google email address, profile name when available and a stable Google account identifier. NaTarot does not receive or store your Google password.",
            vi: "Nếu bạn chọn đăng nhập bằng Google, Google cung cấp thông tin nhận dạng cơ bản cần thiết để đăng nhập: email Google, tên hồ sơ nếu có và mã nhận dạng ổn định của tài khoản Google. NaTarot không nhận hoặc lưu mật khẩu Google của bạn.",
          },
          {
            en: "When you use the service, we may store your questions, optional context, selected cards, card orientations, spread/session details, saved rooms, profile details, journal notes and generated reading content. We also use necessary session cookies and short-lived verification, password-reset and Google sign-in state tokens. Passwords are stored only as one-way password hashes, not in plain text.",
            vi: "Khi bạn sử dụng dịch vụ, chúng tôi có thể lưu câu hỏi, bối cảnh bổ sung, các lá bài đã chọn, chiều của lá bài, thông tin trải bài/phiên, phòng đã lưu, thông tin hồ sơ, ghi chú nhật ký và nội dung trải bài được tạo. Chúng tôi cũng dùng cookie phiên cần thiết và token ngắn hạn cho xác minh, đặt lại mật khẩu và trạng thái đăng nhập Google. Mật khẩu chỉ được lưu dưới dạng hash một chiều, không lưu dạng văn bản thuần.",
          },
        ],
      },
      {
        id: "use",
        title: { en: "How we use information", vi: "Cách chúng tôi sử dụng thông tin" },
        bullets: [
          {
            en: "Create, verify, secure and support your member account, including login and password recovery.",
            vi: "Tạo, xác minh, bảo vệ và hỗ trợ tài khoản thành viên, bao gồm đăng nhập và khôi phục mật khẩu.",
          },
          {
            en: "Save and restore your rooms, readings, journal entries and profile choices when you ask us to.",
            vi: "Lưu và khôi phục phòng, trải bài, nhật ký và lựa chọn hồ sơ khi bạn yêu cầu.",
          },
          {
            en: "Use your phone number for customer care and account-related support, not for public display by default.",
            vi: "Dùng số điện thoại để chăm sóc khách hàng và hỗ trợ liên quan đến tài khoản, mặc định không hiển thị công khai.",
          },
          {
            en: "Send account verification and password-reset messages through Resend, our transactional email provider.",
            vi: "Gửi email xác minh tài khoản và đặt lại mật khẩu thông qua Resend, nhà cung cấp email giao dịch của chúng tôi.",
          },
          {
            en: "Prevent abuse, enforce rate limits, protect the service and troubleshoot technical problems using necessary request and security metadata.",
            vi: "Ngăn lạm dụng, áp dụng giới hạn yêu cầu, bảo vệ dịch vụ và xử lý lỗi kỹ thuật bằng siêu dữ liệu yêu cầu và bảo mật cần thiết.",
          },
        ],
      },
      {
        id: "ai",
        title: { en: "AI readings and service providers", vi: "Trải bài AI và nhà cung cấp dịch vụ" },
        paragraphs: [
          {
            en: "To generate an AI reading, NaTarot may send the question, optional context and selected-card/spread information to the configured AI provider (currently DeepSeek). We do not send your password, phone number or Google OAuth token as part of that reading request. Resend receives the recipient address and message content needed to deliver verification or password-reset email.",
            vi: "Để tạo trải bài AI, NaTarot có thể gửi câu hỏi, bối cảnh bổ sung và thông tin lá bài/trải bài đã chọn đến nhà cung cấp AI được cấu hình (hiện là DeepSeek). Chúng tôi không gửi mật khẩu, số điện thoại hoặc token OAuth Google trong yêu cầu tạo trải bài. Resend nhận địa chỉ người nhận và nội dung cần thiết để gửi email xác minh hoặc đặt lại mật khẩu.",
          },
          {
            en: "We do not sell personal information or use Google account data for advertising. We use Google account data only to create, link and secure your NaTarot member account and to provide the sign-in flow you request.",
            vi: "Chúng tôi không bán thông tin cá nhân và không dùng dữ liệu tài khoản Google cho quảng cáo. Dữ liệu tài khoản Google chỉ được dùng để tạo, liên kết và bảo vệ tài khoản thành viên NaTarot, cũng như cung cấp luồng đăng nhập mà bạn yêu cầu.",
          },
        ],
      },
      {
        id: "retention",
        title: { en: "Retention, access and deletion", vi: "Lưu trữ, truy cập và xóa dữ liệu" },
        paragraphs: [
          {
            en: "We keep account and saved-content information while it is needed to provide the service or while your account remains active. Session, verification and password-reset tokens are short-lived or revoked when used. You may request access, correction or deletion of your account information by contacting support at zerotqt001@gmail.com.",
            vi: "Chúng tôi lưu thông tin tài khoản và nội dung đã lưu trong thời gian cần thiết để cung cấp dịch vụ hoặc khi tài khoản của bạn còn hoạt động. Token phiên, xác minh và đặt lại mật khẩu có thời hạn ngắn hoặc bị thu hồi sau khi sử dụng. Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa thông tin tài khoản bằng cách liên hệ zerotqt001@gmail.com.",
          },
        ],
      },
      {
        id: "changes",
        title: { en: "Changes and contact", vi: "Thay đổi và liên hệ" },
        paragraphs: [
          {
            en: "We may update this policy when the service or its data practices change. The effective date shown above will be updated when material changes are made. For privacy questions, contact zerotqt001@gmail.com.",
            vi: "Chúng tôi có thể cập nhật chính sách khi dịch vụ hoặc cách xử lý dữ liệu thay đổi. Ngày hiệu lực ở trên sẽ được cập nhật khi có thay đổi quan trọng. Nếu có câu hỏi về riêng tư, hãy liên hệ zerotqt001@gmail.com.",
          },
        ],
      },
    ],
  },
  terms: {
    path: "/terms",
    title: { en: "Terms of Service", vi: "Điều khoản sử dụng" },
    summary: {
      en: "The simple rules for using NaTarot and its reflective Tarot features.",
      vi: "Các nguyên tắc cơ bản khi sử dụng NaTarot và các tính năng Tarot chiêm nghiệm.",
    },
    sections: [
      {
        id: "service",
        title: { en: "The service", vi: "Dịch vụ" },
        paragraphs: [
          {
            en: "NaTarot provides digital Tarot cards, spreads, rooms, guidebook content, journaling and optional AI-generated reflective readings. The service is for personal reflection and entertainment, not a promise of future events or professional advice.",
            vi: "NaTarot cung cấp lá bài Tarot kỹ thuật số, trải bài, phòng, nội dung thư viện, nhật ký và trải bài chiêm nghiệm do AI tạo tùy chọn. Dịch vụ phục vụ tự chiêm nghiệm và giải trí, không cam kết về sự kiện tương lai và không phải tư vấn chuyên môn.",
          },
        ],
      },
      {
        id: "account",
        title: { en: "Your account", vi: "Tài khoản của bạn" },
        bullets: [
          {
            en: "You are responsible for the accuracy of the information you provide and for keeping your login details private.",
            vi: "Bạn chịu trách nhiệm về tính chính xác của thông tin cung cấp và giữ bí mật thông tin đăng nhập.",
          },
          {
            en: "Do not use another person's account, impersonate another person or use the service to harass, threaten or abuse anyone.",
            vi: "Không sử dụng tài khoản của người khác, mạo danh hoặc dùng dịch vụ để quấy rối, đe dọa hay lạm dụng bất kỳ ai.",
          },
          {
            en: "We may limit or disable access when needed to protect members, the service or the security of the platform.",
            vi: "Chúng tôi có thể giới hạn hoặc vô hiệu hóa quyền truy cập khi cần để bảo vệ thành viên, dịch vụ hoặc an toàn của nền tảng.",
          },
        ],
      },
      {
        id: "content",
        title: { en: "Your content and our content", vi: "Nội dung của bạn và nội dung của chúng tôi" },
        paragraphs: [
          {
            en: "You keep your rights to questions, notes and other content you submit. You give NaTarot permission to store and process that content only as needed to operate the features you use. NaTarot's name, interface, card presentation and original software are protected by applicable rights and may not be copied or misused.",
            vi: "Bạn giữ quyền đối với câu hỏi, ghi chú và nội dung khác do bạn gửi. Bạn cho phép NaTarot lưu và xử lý nội dung đó trong phạm vi cần thiết để vận hành các tính năng bạn sử dụng. Tên NaTarot, giao diện, cách trình bày lá bài và phần mềm gốc được bảo vệ theo quyền áp dụng và không được sao chép hoặc sử dụng sai mục đích.",
          },
        ],
      },
      {
        id: "availability",
        title: { en: "Availability and changes", vi: "Tính khả dụng và thay đổi" },
        paragraphs: [
          {
            en: "We work to keep NaTarot available and secure, but features may change, pause or become unavailable for maintenance, provider outages or other reasons. We may update these terms when the service changes. Continued use after an update means you accept the updated terms.",
            vi: "Chúng tôi cố gắng duy trì NaTarot hoạt động và an toàn, nhưng tính năng có thể thay đổi, tạm dừng hoặc không khả dụng vì bảo trì, sự cố nhà cung cấp hoặc lý do khác. Chúng tôi có thể cập nhật điều khoản khi dịch vụ thay đổi. Việc tiếp tục sử dụng sau cập nhật đồng nghĩa bạn chấp nhận điều khoản mới.",
          },
        ],
      },
      {
        id: "contact",
        title: { en: "Contact", vi: "Liên hệ" },
        paragraphs: [
          {
            en: "Questions about these terms can be sent to zerotqt001@gmail.com. These terms were last updated on September 19, 2026.",
            vi: "Bạn có thể gửi câu hỏi về điều khoản đến zerotqt001@gmail.com. Điều khoản này được cập nhật lần cuối ngày 19 tháng 9 năm 2026.",
          },
        ],
      },
    ],
  },
};
