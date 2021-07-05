import React, { FC, useState } from "react";
import styled from "styled-components";
import { Page, NavLinkSidebarItem } from "@reach/chrome";
import { Redirect, Route, Switch, useRouteMatch } from "react-router-dom";
import { SvelteComponent } from "./SvelteComponent";
import Hello from "./Hello.svelte";

export const HelloRoutes: FC = () => {
  const match = useRouteMatch();
  return (
    <Switch>
      <Route path={match.url + "/users"} component={UsersPage} />
      <Route path={match.url + "/docs"} component={DocsPage} />
      <Redirect to={match.url + "/users"} />
    </Switch>
  );
};

export const UsersPage: FC = () => {
  const [counter, setCounter] = useState(120);
  return (
    <Page title="Hello World" submenuContents={<Menu />}>
      <Host>
        <Container>
          <Title>Users</Title>
          <button onClick={() => setCounter(counter + 1)}>Click</button>
          <SvelteComponent component={Hello} count={counter} />
        </Container>
      </Host>
    </Page>
  );
};

export const DocsPage: FC = () => {
  return (
    <Page title="Documents" submenuContents={<Menu />}>
      <Host>
        <Container>
          <Title>Documents</Title>
        </Container>
      </Host>
    </Page>
  );
};

const Menu: FC = ({}) => {
  return (
    <div>
      <NavLinkSidebarItem route="users" title="Users" icon="FabricUserFolder" />
      <NavLinkSidebarItem route="docs" title="Documents" icon="DocumentSet" />
    </div>
  );
};

const Host = styled.div``;

const Container = styled.div`
  display: flex;
  max-width: 800px;
  margin: 0 auto;
  flex-direction: column;
`;

const Title = styled.h1`
  flex: 1;
  margin-bottom: 10px;
`;
