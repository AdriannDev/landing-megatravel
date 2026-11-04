import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import { NewDate } from "./new-date";

export function NewDateView(props: AdminViewServerProps) {
  const {
    initPageResult: { req, permissions, visibleEntities },
    params,
    searchParams,
  } = props;
  if (!req.user || !["editor", "admin"].includes(String(req.user.role)))
    redirect("/admin/login");
  return (
    <DefaultTemplate
      req={req}
      i18n={req.i18n}
      locale={props.initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <NewDate />
      </Gutter>
    </DefaultTemplate>
  );
}
