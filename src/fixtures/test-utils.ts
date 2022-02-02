declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // tslint:disable-next-line: interface-name
    interface Matchers<R, T> {
      toHaveBeenCalledNthWith<P>(times: number, expected: P): R;
      toHaveCoreError(message: RegExp): R;
      toHaveCoreOutput(key: string, value: string): R;
    }
  }
}

const setFailedMock = jest.fn();
export const setOutputMock = jest.fn();
const startGroupMock = jest.fn();
const endGroupMock = jest.fn();
const infoMock = jest.fn();

const actionsCoreMock = jest.mock('@actions/core', () => {
  return {
    endGroup: endGroupMock,
    getInput: (name: string, options?: { required: boolean }) => {
      if (options && options.required && !Object.keys(process.env).includes(`INPUT_${name.toUpperCase()}`)) {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      return process.env[`INPUT_${name.toUpperCase()}`];
    },
    info: infoMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
    startGroup: startGroupMock,
  };
});

export const uploadReleaseAssetMock = jest.fn();

const githubMock = jest.mock('@actions/github', () => {
  return {
    getOctokit: jest.fn().mockImplementation(() => {
      return {
        rest: {
          repos: {
            uploadReleaseAsset: uploadReleaseAssetMock,
          },
        },
      };
    }),
    context: {
      repo: {
        owner: 'owner',
        repo: 'repo',
      },
    },
  };
});

const inputVariables: { [key: string]: string } = {};

export const setInput = (name: string, value: string) => {
  const variableName = `INPUT_${name.toUpperCase()}`;
  inputVariables[variableName] = value;
  process.env[variableName] = value;
};

export const clearTestEnvironment = () => {
  for (const variableName of Object.keys(inputVariables)) {
    Reflect.deleteProperty(process.env, variableName);
    Reflect.deleteProperty(inputVariables, variableName);
  }
  actionsCoreMock.clearAllMocks();
  githubMock.clearAllMocks();
};

expect.extend({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toHaveBeenCalledNthWith: function (recieved: jest.Mock, times: number, match: any) {
    const passTimes = recieved.mock.calls.length > 0 && recieved.mock.calls.length === times ? true : false;
    const options = {
      comment: 'Error.message equality',
      isNot: this.isNot,
      promise: this.promise,
    };
    const callParameters = recieved.mock.calls[0][0];
    const expectedKeys = Object.keys(match);
    const matchData = Object.create({});
    for (const key of expectedKeys) {
      matchData[key] = callParameters[key];
    }
    const passDiff = expectedKeys.some((key) => {
      if (matchData[key] !== match[key]) {
        return key;
      }
    })
      ? false
      : true;
    const pass = passTimes && passDiff;
    return {
      message: () => {
        if (!passDiff || !passTimes) {
          // tslint:disable-next-line: max-line-length
          return this.utils.matcherHint(
            'toHaveBeenCalledNthWith',
            JSON.stringify(matchData),
            JSON.stringify(match),
            options,
          );
        } else {
          const diff = this.utils.diff(match, matchData, {
            expand: this.expand,
          });
          // tslint:disable-next-line: max-line-length
          return (
            this.utils.matcherHint(
              'toHaveBeenCalledNthWith',
              JSON.stringify(matchData),
              JSON.stringify(match),
              options,
            ) + `\n\n${diff}`
          );
        }
      },
      pass,
    };
  },
  // tslint:disable-next-line: object-literal-shorthand space-before-function-paren
  toHaveCoreError: function (recieved: jest.Mock, message: RegExp) {
    const error = setFailedMock.mock.calls.length > 0 ? (setFailedMock.mock.calls[0][0] as Error) : undefined;
    const pass = error && message.test(error.message) ? true : false;
    const options = {
      comment: 'Error.message equality',
      isNot: this.isNot,
      promise: this.promise,
    };

    return {
      message: () => {
        if (pass) {
          return this.utils.matcherHint('toHaveCoreError', error?.message, `${message}`, options);
        } else {
          const diff = this.utils.diff(message, error?.message, {
            expand: this.expand,
          });
          return this.utils.matcherHint('toHaveCoreError', error?.message, `${message}`, options) + `\n\n${diff}`;
        }
      },
      pass,
    };
  },
  // tslint:disable-next-line: object-literal-shorthand space-before-function-paren
  toHaveCoreOutput: function (recieved: jest.Mock, key: string, value: string) {
    const keyMatch = setOutputMock.mock.calls.find((call) => call[0] === key);
    const match = setOutputMock.mock.calls.find((call) => call[0] === key && call[1] === value);
    const pass = match ? true : false;
    const options = {
      isNot: this.isNot,
      promise: this.promise,
    };

    return {
      message: () => {
        if (pass) {
          return this.utils.matcherHint('toHaveCoreOutput', `${match[0]}=${match[1]}`, `${key}=${value}`, options);
        } else {
          const diff = this.utils.diff(`${key}=${value}`, keyMatch ? `${keyMatch[0]}=${keyMatch[1]}` : '', {
            expand: this.expand,
          });
          return (
            this.utils.matcherHint(
              'toHaveCoreError',
              keyMatch ? `${keyMatch[0]}=${keyMatch[1]}` : '',
              `${key}=${value}`,
              options,
            ) + `\n\n${diff}`
          );
        }
      },
      pass,
    };
  },
});
