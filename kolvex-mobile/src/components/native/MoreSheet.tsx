/** iOS only: Android and web open the menu from the Dock's (more) tab instead. */
export type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export default function MoreSheet(_props: MoreSheetProps) {
  return null;
}
