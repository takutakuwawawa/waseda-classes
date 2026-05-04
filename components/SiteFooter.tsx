export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--bg)] px-5 py-6 text-[11px] leading-relaxed text-[var(--text-faint)]">
      <div className="mx-auto max-w-6xl space-y-2">
        <p>
          Minervaは、早稲田大学に通う学生が個人的な履修検討のために作成している非公式サイトです。
          早稲田大学および各学部・研究科の公式サービスではありません。営利目的での運営、販売、配布は行いません。
        </p>
        <p>
          授業情報は公式シラバス等をもとに整理していますが、正確性・最新性を保証するものではありません。
          履修登録や科目選択の最終確認は、必ず
          <a
            href="https://www.wsl.waseda.jp/syllabus/JAA101.php"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 font-medium text-[var(--text-muted)] underline-offset-2 hover:underline"
          >
            早稲田大学公式Webシラバス
          </a>
          および所属学部・研究科の案内で確認してください。
        </p>
        <p>
          プライバシーについて: このサイトでは、ログイン用ID、学部・学年、履修候補、投稿された口コミ・BBS内容など、
          サイトの機能提供に必要な範囲の情報を扱います。取得した情報を広告配信、販売、第三者への提供目的で利用することはありません。
        </p>
        <p>
          連絡先・削除依頼・問題の報告:
          <a
            href="https://github.com/takutakuwawawa/waseda-classes"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 font-medium text-[var(--text-muted)] underline-offset-2 hover:underline"
          >
            GitHubリポジトリ
          </a>
          から管理者へ連絡してください。
        </p>
      </div>
    </footer>
  );
}
