import { Mode } from "@shared/storage/types"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"
import { getModeSpecificFields } from "../utils/providerUtils"

interface CustomConfigProviderProps {
    currentMode: Mode
    isPopup?: boolean
    showModelOptions: boolean
}

export const CustomConfigProvider = ({ currentMode, isPopup, showModelOptions }: CustomConfigProviderProps) => {
    const { apiConfiguration } = useExtensionState()
    const { handleFieldChange, handleModeFieldChange } = useApiConfigurationHandlers()
    const { customConfigModelId } = getModeSpecificFields(apiConfiguration, currentMode)

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
            <div className="mb-2">
                <div style={{ marginBottom: 5, fontWeight: 500 }}>Base URL</div>
                <DebouncedTextField
                    initialValue={apiConfiguration?.customConfigBaseUrl || ""}
                    onChange={(value) => handleFieldChange("customConfigBaseUrl", value)}
                    placeholder={"Enter base URL..."}
                />
            </div>

            <div className="mb-2">
                <div style={{ marginBottom: 5, fontWeight: 500 }}>Model ID</div>
                <DebouncedTextField
                    initialValue={customConfigModelId || ""}
                    onChange={(value) => handleModeFieldChange({ plan: "planModeCustomConfigModelId", act: "actModeCustomConfigModelId" }, value, currentMode)}
                    placeholder={"Enter Model ID..."}
                />
            </div>
        </div>
    )
}
