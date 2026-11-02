import { useState } from "react";
import { Field } from "../Content";
import { Button } from "../UI";
import { calendarDate } from "../../lib/technicalData";
export type DateFieldProps = {
  value: string;
  onChange: (date: string) => void;
  label: string;
};
export default function DateField({ value, onChange, label }: DateFieldProps) {
  const [draft, setDraft] = useState(value);
  return (
    <>
      <Field
        label={label}
        value={draft}
        onChangeText={setDraft}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      <Button disabled={!calendarDate(draft)} onPress={() => onChange(draft)}>
        应用阅读日期
      </Button>
    </>
  );
}
