export type ModalStackRoutes = {
  QRCode: undefined;
  RootStack: undefined;
};

export type HomeStackRoutes = {
  Home: undefined;
  ProjectsList: { accountName: string };
  SnacksList: { accountName: string };
  ProjectDetails: { id: string };
  Branches: { appId: string };
  BranchDetails: { appId: string; branchName: string };
  Account: undefined;
  Project: { id: string };
  FeedbackForm: undefined;
  VibraCreateApp: undefined;
  VibraAppLoading: { sessionId: string; prompt: string };
  VibraChat: { sessionId: string };
};

export type SettingsStackRoutes = {
  Settings: undefined;
  DeleteAccount: { viewerUsername: string };
};

export type DiagnosticsStackRoutes = {
  Diagnostics: object;
  Audio: object;
  Location: object;
  Geofencing: object;
};

export type CreateAppStackRoutes = {
  CreateApp: undefined;
  VibraAppLoading: { sessionId: string; prompt: string };
  VibraChat: { sessionId: string };
};

export type ProfileStackRoutes = {
  Profile: undefined;
};

export type VibraTabRoutes = {
  Home: undefined;
  CreateApp: undefined;
  Profile: undefined;
  VibraBilling: undefined;
};
