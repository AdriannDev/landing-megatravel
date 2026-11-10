import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import { MailPilot } from "./mail-pilot";

export function MailPilotView(props: AdminViewServerProps) {
  const {
    initPageResult: { req, permissions, visibleEntities },
    params,
    searchParams,
  } = props;
  if (req.user?.role !== "admin") redirect("/admin/login");
  return (
    <DefaultTemplate
      req={req}
      i18n={req.i18n}
      locale={props.initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <MailPilot />
      </Gutter>
    </DefaultTemplate>
  );
}
